/**
 * Reservas de Espaços — Sistema de autoatendimento para reservar espaços
 * Backend.gs — projeto ÚNICO, vinculado à planilha (Extensões > Apps Script).
 *
 * Acesso por E-MAIL + PIN (sem login Google), para funcionar em celulares com
 * mais de uma conta conectada. A planilha continua privada: o script roda com a
 * conta do administrador e o usuário nunca toca nela.
 *
 * Implantar como App da Web:  Executar como: Eu  |  Quem pode acessar: Qualquer pessoa
 *
 * NOVIDADES DA V5
 *   - A aba Autorizados agora tem as colunas Pastoral, Nome e WhatsApp.
 *     Depois do login, o formulário já vem com Pastoral / Movimento, Seu nome e
 *     WhatsApp preenchidos com esses dados (a pessoa pode alterar). Se a célula
 *     estiver vazia na planilha, o campo fica em branco.
 *   - O cabeçalho mostra "Nome - Pastoral" (ex.: "Maria - Administrador").
 *   - As colunas da aba Autorizados são localizadas PELO NOME do cabeçalho, então
 *     a ordem delas não importa (pode inserir ou mover colunas à vontade).
 *
 * NOVIDADES DA V4 (mantidas)
 *   - Alteração e cancelamento só até o DIA ANTERIOR à data da reserva.
 *   - Toda alteração ou cancelamento grava ANTES uma cópia da reserva original
 *     na aba "Alteracao_Cancelamento" (Tipo = Cancelamento ou Alteração).
 *   - Espaço "Externo": pergunta se deseja reservar mesas (1 a 100) e/ou
 *     cadeiras (1 a 400). A coluna Itens_Cozinha já existe, vazia.
 *
 * Abas da planilha "Reservas-Espacos":
 *   - Reservas    : Data | Turno | Espaco | Pastoral_Reservada | Nome | Contato_WhatsApp | Motivo |
 *                   Timestamp_Reserva | Email_Usuario | Mesas | Cadeiras | Itens_Cozinha
 *   - Alteracao_Cancelamento : Tipo | Timestamp_Operacao | Email_Operador | Detalhe |
 *                   + todas as colunas da reserva ANTERIOR (mesma ordem da aba Reservas)
 *   - Bloqueios   : Data | Motivo | Observacao | Turno | Ate_Data | Dias_Semana
 *   - Patrimonio  : ESPAÇO | HORÁRIO   (OBRIGATÓRIA — única fonte de espaços e turnos)
 *   - Pastorais   : Pastoral
 *   - Autorizados : Email | Pastoral | Nome | WhatsApp | PIN | Ativo
 *                   (qualquer ordem; Email e PIN são obrigatórios)
 *
 * Turno "Dia inteiro" (escreva exatamente assim na coluna HORÁRIO da aba Patrimonio):
 *   - só pode ser reservado se o espaço estiver livre em TODOS os turnos da data;
 *   - depois de reservado, o espaço fica ocupado em todos os turnos daquela data.
 *
 * Bloqueios flexíveis (aba Bloqueios — só Data e Motivo são obrigatórios):
 *   - Turno vazio (ou "Dia inteiro")  -> bloqueia o dia todo, como antes.
 *   - Turno preenchido (ex.: "Noite" ou "Tarde, Noite") -> bloqueia só esse(s)
 *     turno(s), para todos os espaços. Os outros turnos continuam livres.
 *   - Ate_Data preenchida -> repete o bloqueio de Data até Ate_Data.
 *   - Dias_Semana (ex.: "Quinta" ou "Terça, Quinta") -> junto com Ate_Data,
 *     aplica só nesses dias da semana. Ex.: todas as quintas de outubro à noite:
 *       Data 01/10/2026 | Motivo Adoração | | Turno Noite | Ate_Data 31/10/2026 | Dias_Semana Quinta
 *
 * Ao atualizar da V4 para a V5: rode `configurarPlanilha()` uma vez no editor.
 * Ela só ACRESCENTA no fim da aba Autorizados as colunas que estiverem faltando
 * (Pastoral, Nome, WhatsApp, Ativo); nada do que já existe é apagado ou movido.
 */

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================
const CONFIG = {
  // Vazio = script vinculado à planilha. Se for avulso, cole o ID da planilha.
  SPREADSHEET_ID: '',

  // Logo: prefira o ID do arquivo no Drive (o trecho entre /d/ e /view do link).
  // Assim o próprio sistema entrega a imagem e o arquivo NÃO precisa ser público.
  LOGO_FILE_ID: '',
  // Alternativa: URL pública de uma imagem. Só é usada se LOGO_FILE_ID estiver vazio.
  LOGO_URL: '',
  NOME_INSTITUICAO: 'Nome da Sua Instituição',

  // Contato mostrado nas mensagens de erro (acesso desativado, prazo de alteração etc.).
  CONTATO_SUPORTE: '(00) 00000-0000',

  ABA_RESERVAS: 'Reservas',
  ABA_HISTORICO: 'Alteracao_Cancelamento',
  ABA_BLOQUEIOS: 'Bloqueios',
  ABA_PATRIMONIO: 'Patrimonio',
  ABA_AUTORIZADOS: 'Autorizados',
  ABA_PASTORAIS: 'Pastorais',

  // Nome do turno que ocupa o dia todo (maiúsculas e acentos não importam).
  TURNO_DIA_INTEIRO: 'Dia inteiro',

  // Espaço que permite reservar mesas e cadeiras (nome igual ao da aba Patrimonio).
  ESPACO_EXTERNO: 'Externo',
  MESAS_MAX: 100,
  CADEIRAS_MAX: 400,

  // Período em que as reservas são aceitas (AAAA-MM-DD). São 2 anos.
  PERIODO_INICIO: '2026-01-01',
  PERIODO_FIM: '2027-12-31',

  // Quantos dias o aparelho continua conectado sem pedir o PIN de novo.
  DIAS_SESSAO: 60,
  // Tentativas erradas de PIN antes de bloquear o e-mail por 15 minutos.
  MAX_TENTATIVAS: 4,

  MOTIVO_MIN: 7,
  MOTIVO_MAX: 50,

  // Quantos nomes de espaço aparecem em cada dia do calendário.
  ESPACOS_NO_CALENDARIO: 3
};

const CAB_RESERVAS = ['Data', 'Turno', 'Espaco', 'Pastoral_Reservada', 'Nome',
  'Contato_WhatsApp', 'Motivo', 'Timestamp_Reserva', 'Email_Usuario',
  'Mesas', 'Cadeiras', 'Itens_Cozinha'];
const CAB_HISTORICO = ['Tipo', 'Timestamp_Operacao', 'Email_Operador', 'Detalhe'].concat(CAB_RESERVAS);
const CAB_BLOQUEIOS = ['Data', 'Motivo', 'Observacao', 'Turno', 'Ate_Data', 'Dias_Semana'];
// Cabeçalho usado só quando a aba Autorizados ainda NÃO existe.
const CAB_AUTORIZADOS = ['Email', 'Pastoral', 'Nome', 'WhatsApp', 'PIN', 'Ativo'];
const CAB_PATRIMONIO = ['ESPAÇO', 'HORÁRIO'];

/**
 * Nomes aceitos no cabeçalho de cada coluna da aba Autorizados.
 * Maiúsculas, acentos, espaços e hífens não importam ("E-mail" = "email").
 * O primeiro nome de cada lista é o usado quando o sistema cria a coluna.
 */
const COLS_AUTORIZADOS = {
  email: ['Email', 'E-mail'],
  pastoral: ['Pastoral', 'Pastoral / Movimento', 'Movimento'],
  nome: ['Nome', 'Nome completo'],
  whatsapp: ['WhatsApp', 'Whastapp', 'Whatsap', 'Contato', 'Contato_WhatsApp', 'Celular', 'Telefone'],
  pin: ['PIN'],
  ativo: ['Ativo']
};

// Posição (1 = coluna A) das colunas da aba Reservas usadas pelo sistema.
const COL_TURNO = 2, COL_ESPACO = 3, COL_MOTIVO = 7, COL_EMAIL = 9,
  COL_MESAS = 10, COL_CADEIRAS = 11;

// Quantas colunas fixas vêm antes da cópia da reserva na aba Alteracao_Cancelamento.
const HIST_PREFIXO = 4;

// ============================================================================
// WEB APP + API
// ============================================================================
/**
 * Duas funções num endereço só:
 *  - sem parâmetros  -> entrega a página (quando aberta direto no /exec)
 *  - com ?acao=...   -> responde como API para a página hospedada fora do Google
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.acao) {
    let saida;
    try {
      saida = { ok: true, dados: executarAcao_(p.acao, JSON.parse(p.args || '[]')) };
    } catch (err) {
      saida = { ok: false, erro: err.message || String(err) };
    }
    const texto = JSON.stringify(saida);
    if (p.callback) { // caminho reserva (JSONP), usado se o principal for bloqueado
      return ContentService.createTextOutput(p.callback + '(' + texto + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(texto).setMimeType(ContentService.MimeType.JSON);
  }
  return paginaHtml_();
}

/** Caminho principal: a página envia um POST com { acao, args }. */
function doPost(e) {
  let saida;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    saida = { ok: true, dados: executarAcao_(req.acao, Array.isArray(req.args) ? req.args : []) };
  } catch (err) {
    saida = { ok: false, erro: err.message || String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(saida)).setMimeType(ContentService.MimeType.JSON);
}

/** Lista fechada de ações aceitas. Cada uma valida sessão/PIN por conta própria. */
function executarAcao_(acao, args) {
  const acoes = {
    getLogo: function () { return logoParaPagina_(); },
    fazerLogin: function () { return fazerLogin(args[0], args[1]); },
    sair: function () { return sair(args[0]); },
    getDadosIniciais: function () { return getDadosIniciais(args[0]); },
    getDisponibilidade: function () { return getDisponibilidade(args[0], args[1], args[2]); },
    salvarReserva: function () { return salvarReserva(args[0], args[1]); },
    getDadosCalendario: function () { return getDadosCalendario(args[0]); },
    getDetalhesDia: function () { return getDetalhesDia(args[0], args[1]); },
    getMinhasReservas: function () { return getMinhasReservas(args[0], args[1]); },
    cancelarReserva: function () { return cancelarReserva(args[0], args[1]); },
    alterarReserva: function () { return alterarReserva(args[0], args[1]); }
  };
  if (!acoes.hasOwnProperty(acao)) throw new Error('Ação inválida.');
  return acoes[acao]();
}

function paginaHtml_() {
  const t = HtmlService.createTemplateFromFile('Index');
  t.logoUrl = logoParaPagina_();
  t.nomeInstituicao = CONFIG.NOME_INSTITUICAO;
  return t.evaluate()
    .setTitle('Reservas de Espaços — ' + CONFIG.NOME_INSTITUICAO)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Devolve a logo pronta para a página. Com LOGO_FILE_ID, lê o arquivo no Drive
 * com a conta do administrador e embute a imagem na própria página, sem precisar
 * compartilhar o arquivo com ninguém.
 */
function logoParaPagina_() {
  if (!CONFIG.LOGO_FILE_ID) return CONFIG.LOGO_URL || '';
  const cache = CacheService.getScriptCache();
  try {
    const n = Number(cache.get('logo_n') || 0);
    const tamanho = Number(cache.get('logo_len') || 0);
    if (n > 0 && tamanho > 0) {
      let montada = '';
      for (let i = 0; i < n; i++) montada += (cache.get('logo_' + i) || '');
      // só usa o cache se estiver completo (pedaços podem expirar em momentos diferentes)
      if (montada.length === tamanho && montada.indexOf('data:') === 0) return montada;
    }
    const blob = DriveApp.getFileById(CONFIG.LOGO_FILE_ID).getBlob();
    const bytes = blob.getBytes();
    if (bytes.length > 1500000) {
      console.warn('Logo muito grande (' + Math.round(bytes.length / 1024) + ' KB). Reduza a imagem.');
    }
    const dataUrl = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(bytes);
    const pedacos = [];
    for (let i = 0; i < dataUrl.length; i += 90000) pedacos.push(dataUrl.substring(i, i + 90000));
    if (pedacos.length <= 20) {
      const guardar = { logo_n: String(pedacos.length), logo_len: String(dataUrl.length) };
      pedacos.forEach(function (p, i) { guardar['logo_' + i] = p; });
      cache.putAll(guardar, 21600); // 6 horas
    }
    return dataUrl;
  } catch (e) {
    console.error('Falha ao ler a logo: ' + e.message);
    return CONFIG.LOGO_URL || '';
  }
}

/** Chamada pela página para buscar a logo (não exige estar conectado). */
function getLogo() {
  return logoParaPagina_();
}

/** Rode no editor para autorizar o acesso ao Drive e conferir a logo. */
function testarLogo() {
  const d = logoParaPagina_();
  Logger.log(d ? (d.indexOf('data:') === 0
    ? 'Logo embutida com sucesso (' + Math.round(d.length / 1024) + ' KB).'
    : 'Usando LOGO_URL: ' + d) : 'Nenhuma logo configurada.');
}

/** Limpa a logo guardada em cache (rode após trocar a imagem). */
function limparCacheLogo() {
  const cache = CacheService.getScriptCache();
  const chaves = ['logo_n', 'logo_len'];
  for (let i = 0; i < 20; i++) chaves.push('logo_' + i);
  cache.removeAll(chaves);
  Logger.log('Cache da logo limpo.');
}

// ============================================================================
// ABA AUTORIZADOS (lida pelo NOME das colunas — a ordem não importa)
// ============================================================================
/** "E-mail" / "Whats App" / "PIN " -> "email" / "whatsapp" / "pin" */
function chaveCab_(v) {
  return norm_(v).replace(/[^a-z0-9]/g, '');
}

/**
 * Localiza as colunas da aba Autorizados.
 * Retorna { aba, largura, mapa: { email, pastoral, nome, whatsapp, pin, ativo } },
 * onde cada valor do mapa é o índice da coluna (0 = A) ou -1 se não existir.
 */
function mapaAutorizados_() {
  const aba = obterAba_(CONFIG.ABA_AUTORIZADOS, CAB_AUTORIZADOS, true);
  const largura = Math.max(aba.getLastColumn(), 1);
  const cab = aba.getRange(1, 1, 1, largura).getValues()[0].map(chaveCab_);
  const mapa = {};
  Object.keys(COLS_AUTORIZADOS).forEach(function (campo) {
    const aceitos = COLS_AUTORIZADOS[campo].map(chaveCab_);
    mapa[campo] = cab.findIndex(function (c) { return c && aceitos.indexOf(c) !== -1; });
  });
  return { aba: aba, largura: largura, mapa: mapa };
}

/** Lê todas as pessoas da aba Autorizados como objetos. */
function lerAutorizados_() {
  const a = mapaAutorizados_();
  const m = a.mapa;
  if (m.email < 0 || m.pin < 0) {
    throw new Error('A aba "' + CONFIG.ABA_AUTORIZADOS + '" precisa das colunas Email e PIN ' +
      '(confira o nome no cabeçalho, linha 1).');
  }
  const ultima = a.aba.getLastRow();
  if (ultima < 2) return [];
  const cel = function (l, campo) { return m[campo] >= 0 ? l[m[campo]] : ''; };
  return a.aba.getRange(2, 1, ultima - 1, a.largura).getValues().map(function (l) {
    const ativo = txt_(cel(l, 'ativo')).toUpperCase();
    return {
      email: txt_(cel(l, 'email')).toLowerCase(),
      pastoral: txt_(cel(l, 'pastoral')),
      nome: txt_(cel(l, 'nome')),
      whatsapp: whatsDigitos_(cel(l, 'whatsapp')),
      pin: txt_(cel(l, 'pin')),
      ativo: ['NAO', 'NÃO', 'N', 'INATIVO', 'FALSE'].indexOf(ativo) === -1
    };
  });
}

/** Procura o e-mail na aba Autorizados. */
function buscarAutorizado_(email) {
  const alvo = txt_(email).toLowerCase();
  if (!alvo) return null;
  return lerAutorizados_().filter(function (p) { return p.email === alvo; })[0] || null;
}

/** Só os dígitos do WhatsApp, sem o 55 do Brasil (para a máscara da página). */
function whatsDigitos_(v) {
  let d = txt_(v).replace(/\.0+$/, '').replace(/\D/g, '');
  if (d.length > 11 && d.indexOf('55') === 0) d = d.slice(2);
  return d;
}

/** "Maria - Administrador" (Nome - Pastoral). Se faltar algum, mostra o que houver. */
function rotuloUsuario_(p) {
  return [p.nome, p.pastoral].filter(function (x) { return x; }).join(' - ') || p.email;
}

/** Dados da pessoa que a página pode receber (nunca inclui o PIN). */
function perfilPublico_(p) {
  return {
    email: p.email,
    nome: p.nome,
    pastoral: p.pastoral,
    whatsapp: p.whatsapp,
    rotulo: rotuloUsuario_(p)
  };
}

// ============================================================================
// LOGIN POR E-MAIL + PIN
// ============================================================================
/** Entra no sistema. Retorna { ok, token, usuario, nome, email, mensagem }. */
function fazerLogin(email, pin) {
  email = txt_(email).toLowerCase();
  pin = txt_(pin).replace(/\D/g, '');
  const cache = CacheService.getScriptCache();
  const chaveTent = 'tent_' + email;
  const tentativas = Number(cache.get(chaveTent) || 0);

  if (tentativas >= CONFIG.MAX_TENTATIVAS) {
    return { ok: false, mensagem: 'Mais de 4 tentativas erradas. Aguarde 15 minutos e tente de novo.' };
  }
  if (!email || !pin) return { ok: false, mensagem: 'Preencha o e-mail e o PIN.' };

  const pessoa = buscarAutorizado_(email);
  const pinOk = pessoa && pessoa.pin && pessoa.pin === pin;
  if (!pessoa || !pinOk) {
    cache.put(chaveTent, String(tentativas + 1), 900);
    Utilities.sleep(700); // desestimula tentativa automatizada
    return { ok: false, mensagem: 'E-mail ou PIN incorreto. Confira com a secretaria paroquial.' };
  }
  if (!pessoa.ativo) return { ok: false, mensagem: 'Este acesso está desativado. Fale com o Patrimônio ' + CONFIG.CONTATO_SUPORTE + '.' };

  cache.remove(chaveTent);
  const usuario = perfilPublico_(pessoa);
  return { ok: true, token: criarSessao_(pessoa.email), usuario: usuario,
    nome: usuario.rotulo, email: pessoa.email };
}

function criarSessao_(email) {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const exp = Date.now() + CONFIG.DIAS_SESSAO * 24 * 60 * 60 * 1000;
  PropertiesService.getScriptProperties().setProperty(chaveSessao_(token), email + '|' + exp);
  if (Math.random() < 0.1) limparSessoesExpiradas_();
  return token;
}

function chaveSessao_(token) {
  return 'ss_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token)));
}

let pessoaDaSessao_ = null; // quem fez a chamada atual (preenchido por validarSessao_)

/** Confere a sessão e devolve o e-mail. Lança erro "SESSAO" se não valer mais. */
function validarSessao_(token) {
  if (!token) throw new Error('SESSAO: faça login para continuar.');
  const props = PropertiesService.getScriptProperties();
  const chave = chaveSessao_(token);
  const valor = props.getProperty(chave);
  if (!valor) throw new Error('SESSAO: faça login para continuar.');

  const partes = valor.split('|');
  const email = partes[0], exp = Number(partes[1]);
  if (!exp || exp < Date.now()) {
    props.deleteProperty(chave);
    throw new Error('SESSAO: sua conexão expirou. Entre novamente.');
  }
  const pessoa = buscarAutorizado_(email);
  if (!pessoa || !pessoa.ativo) {
    props.deleteProperty(chave);
    throw new Error('SESSAO: seu acesso foi desativado. Fale com o Patrimônio ' + CONFIG.CONTATO_SUPORTE + '.');
  }
  pessoaDaSessao_ = pessoa;
  // Renova a sessão quando passa da metade do prazo
  const metade = CONFIG.DIAS_SESSAO * 24 * 60 * 60 * 1000 / 2;
  if (exp - Date.now() < metade) {
    props.setProperty(chave, email + '|' + (Date.now() + CONFIG.DIAS_SESSAO * 24 * 60 * 60 * 1000));
  }
  return email;
}

function sair(token) {
  if (token) PropertiesService.getScriptProperties().deleteProperty(chaveSessao_(token));
  return { ok: true };
}

function limparSessoesExpiradas_() {
  const props = PropertiesService.getScriptProperties();
  const todas = props.getProperties();
  const agora = Date.now();
  Object.keys(todas).forEach(function (k) {
    if (k.indexOf('ss_') !== 0) return;
    const exp = Number(String(todas[k]).split('|')[1]);
    if (!exp || exp < agora) props.deleteProperty(k);
  });
}

// ============================================================================
// OPERAÇÕES
// ============================================================================

/** Dados para montar a tela: usuário, espaços, turnos, limites de data e bloqueios. */
function getDadosIniciais(token) {
  validarSessao_(token);
  const hoje = hojeStr_();
  return {
    // Dados da aba Autorizados para pré-preencher Pastoral, Nome e WhatsApp
    usuario: perfilPublico_(pessoaDaSessao_),
    hoje: hoje,
    anoVigente: Number(hoje.slice(0, 4)),
    minData: minDataReserva_(),
    maxData: CONFIG.PERIODO_FIM,
    periodoInicio: CONFIG.PERIODO_INICIO,
    periodoFim: CONFIG.PERIODO_FIM,
    hojeEhSabado: diaSemana_(hoje) === 6,
    turnos: listarTurnos_(),
    espacos: listarEspacos_(),
    pastorais: listarPastorais_(),
    // Só os bloqueios de dia inteiro travam a data no calendário do formulário
    bloqueios: lerBloqueios_()
      .filter(function (b) { return !b.turno; })
      .map(function (b) { return { data: b.data, motivo: b.motivo }; }),
    motivoMin: CONFIG.MOTIVO_MIN,
    motivoMax: CONFIG.MOTIVO_MAX,
    espacoExterno: CONFIG.ESPACO_EXTERNO,
    mesasMax: CONFIG.MESAS_MAX,
    cadeirasMax: CONFIG.CADEIRAS_MAX
  };
}

/**
 * Disponibilidade de uma data.
 * `excluir` (opcional) = { turno, espaco } de uma reserva que está sendo EDITADA:
 * ela é ignorada na checagem, para o próprio dono poder mantê-la ou trocá-la.
 * Retorna { data, permitida, mensagem, bloqueio, disponiveis: {turno: [espacos]} }
 */
function getDisponibilidade(token, data, excluir) {
  validarSessao_(token);
  data = normalizarData_(data);
  const turnos = listarTurnos_();
  const espacos = listarEspacos_();
  const resp = { data: data, permitida: true, mensagem: '', bloqueio: null,
    disponiveis: {}, turnosBloqueados: {} };

  const erro = validarDataReserva_(data);
  if (erro) {
    resp.permitida = false;
    resp.mensagem = erro;
    resp.bloqueio = bloqueiosDoDia_(data).diaTodo;
    turnos.forEach(function (t) { resp.disponiveis[t] = []; });
    return resp;
  }

  const ocupacao = ocupacaoDoDia_(data, excluir);
  turnos.forEach(function (t) {
    const bloq = bloqueioDoTurno_(data, t);
    if (bloq) {
      resp.turnosBloqueados[t] = bloq.motivo;
      resp.disponiveis[t] = [];
      return;
    }
    resp.disponiveis[t] = espacos.filter(function (e) {
      return !conflitoReserva_(ocupacao, t, e);
    });
  });
  return resp;
}

/** Grava a reserva com trava de concorrência e nova checagem na planilha. */
function salvarReserva(token, form) {
  const emailUsuario = validarSessao_(token);
  const f = limparFormulario_(form || {});
  const erroValidacao = validarFormulario_(f);
  if (erroValidacao) return { ok: false, codigo: 'VALIDACAO', mensagem: erroValidacao };

  const obj = lerObjetos_(f.espaco, (form || {}).objetos, null);
  if (obj.erro) return { ok: false, codigo: 'VALIDACAO', mensagem: obj.erro };

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000); // aguarda até 30s por outra gravação em andamento
  } catch (e) {
    return { ok: false, codigo: 'OCUPADO',
      mensagem: 'O sistema está recebendo muitas reservas agora. Aguarde alguns segundos e tente de novo.' };
  }

  try {
    // Condição de corrida: relê a planilha DENTRO da trava.
    const erroData = validarDataReserva_(f.data);
    if (erroData) return { ok: false, codigo: 'CONFLITO', mensagem: erroData };

    const bloqTurno = bloqueioDoTurno_(f.data, f.turno);
    if (bloqTurno) {
      return { ok: false, codigo: 'CONFLITO', mensagem: ehDiaInteiro_(f.turno)
        ? 'Não é possível reservar o dia inteiro: o turno ' + bloqTurno.turnoOriginal +
          ' está bloqueado nesta data (' + bloqTurno.motivo + ').'
        : 'O turno ' + f.turno + ' está bloqueado nesta data: ' + bloqTurno.motivo };
    }

    const conflito = conflitoReserva_(ocupacaoDoDia_(f.data), f.turno, f.espaco);
    if (conflito) {
      return { ok: false, codigo: 'CONFLITO', mensagem: mensagemConflito_(conflito, f.espaco, f.turno) };
    }

    const aba = obterAba_(CONFIG.ABA_RESERVAS, CAB_RESERVAS);
    const linha = aba.getLastRow() + 1;
    const destino = aba.getRange(linha, 1, 1, CAB_RESERVAS.length);
    // Data e contato como texto, para o Sheets não converter o formato.
    aba.getRange(linha, 1).setNumberFormat('@');
    aba.getRange(linha, 6).setNumberFormat('@');
    aba.getRange(linha, 8).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    destino.setValues([[
      // Data gravada como 05/10/2026; a lógica interna continua em yyyy-MM-dd
      dataBr_(f.data), f.turno, f.espaco, f.pastoral, f.nome, f.whatsapp, f.motivo,
      new Date(), // Timestamp gerado no servidor, no momento da gravação
      String(emailUsuario || '').toLowerCase(),
      obj.mesas || '', obj.cadeiras || '', '' // Itens_Cozinha: reservado para a próxima versão
    ]]);
    SpreadsheetApp.flush();

    return { ok: true, codigo: 'OK', mensagem: 'Reserva confirmada!',
      reserva: { data: f.data, turno: f.turno, espaco: f.espaco, pastoral: f.pastoral,
        mesas: obj.mesas, cadeiras: obj.cadeiras } };
  } catch (e) {
    console.error(e);
    return { ok: false, codigo: 'ERRO', mensagem: 'Não foi possível salvar agora. Tente novamente.' };
  } finally {
    lock.releaseLock();
  }
}

/** Texto amigável para cada tipo de conflito de espaço/turno. */
function mensagemConflito_(conflito, espaco, turno) {
  if (conflito === 'DIA_INTEIRO') {
    return 'Que pena! "' + espaco + '" já foi reservado para o dia inteiro nesta data. Por favor, escolha outra opção.';
  }
  if (conflito === 'TEM_RESERVA_NO_DIA') {
    return 'Não é possível reservar "' + espaco + '" para o dia inteiro: ele já tem reserva em algum turno desta data. Por favor, escolha outra opção.';
  }
  return 'Que pena! "' + espaco + '" no turno ' + turno +
    ' acabou de ser reservado por outra pessoa. Por favor, escolha outra opção.';
}

// ============================================================================
// MESAS E CADEIRAS (somente no espaço Externo)
// ============================================================================
function ehExterno_(espaco) {
  return norm_(espaco) === norm_(CONFIG.ESPACO_EXTERNO);
}

/** Quantidade enviada pela página: vazio = 0; não inteiro = NaN. */
function qtd_(v) {
  if (v === null || v === undefined || v === '' || v === false) return 0;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

/** Quantidade lida da planilha (célula vazia = 0). */
function qtdLida_(v) {
  const n = Math.floor(Number(v));
  return n > 0 ? n : 0;
}

/**
 * Valida o pedido de mesas/cadeiras.
 * `obj` = { quer: true|false, mesas, cadeiras } enviado pela página.
 * `anteriores` = { mesas, cadeiras } da reserva em edição (ou null numa nova reserva):
 *   se a página não enviar `obj` (versão antiga em cache), mantém o que já estava.
 * Retorna { erro, mesas, cadeiras }.
 */
function lerObjetos_(espaco, obj, anteriores) {
  if (!ehExterno_(espaco)) return { erro: null, mesas: 0, cadeiras: 0 };
  if (obj === undefined || obj === null) {
    if (anteriores) return { erro: null, mesas: anteriores.mesas, cadeiras: anteriores.cadeiras };
    return { erro: 'Responda se deseja reservar mesas, cadeiras ou itens da cozinha. ' +
      'Se a pergunta não aparecer, recarregue a página.' };
  }
  if (obj.quer !== true && obj.quer !== false) {
    return { erro: 'Responda Sim ou Não à pergunta sobre mesas e cadeiras.' };
  }
  if (!obj.quer) return { erro: null, mesas: 0, cadeiras: 0 };

  const mesas = qtd_(obj.mesas), cadeiras = qtd_(obj.cadeiras);
  if (isNaN(mesas) || mesas < 0 || mesas > CONFIG.MESAS_MAX) {
    return { erro: 'A quantidade de mesas deve ser de 1 a ' + CONFIG.MESAS_MAX + '.' };
  }
  if (isNaN(cadeiras) || cadeiras < 0 || cadeiras > CONFIG.CADEIRAS_MAX) {
    return { erro: 'A quantidade de cadeiras deve ser de 1 a ' + CONFIG.CADEIRAS_MAX + '.' };
  }
  if (!mesas && !cadeiras) {
    return { erro: 'Você respondeu Sim: marque Mesas e/ou Cadeiras e informe a quantidade.' };
  }
  return { erro: null, mesas: mesas, cadeiras: cadeiras };
}

// ============================================================================
// CALENDÁRIO
// ============================================================================
/**
 * Resumo de reservas e bloqueios de TODO o período configurado (2 anos).
 * resumo[data] = { n: total de reservas, e: [até 3 nomes de espaço], u: espaços diferentes }
 */
function getDadosCalendario(token) {
  validarSessao_(token);
  const ini = CONFIG.PERIODO_INICIO, fim = CONFIG.PERIODO_FIM;
  const porData = {};
  lerReservas_().forEach(function (r) {
    if (r.data < ini || r.data > fim) return;
    const item = porData[r.data] || (porData[r.data] = { n: 0, espacos: [] });
    item.n++;
    if (item.espacos.indexOf(r.espaco) === -1) item.espacos.push(r.espaco);
  });

  const resumo = {};
  Object.keys(porData).forEach(function (d) {
    const item = porData[d];
    item.espacos.sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
    resumo[d] = {
      n: item.n,
      u: item.espacos.length,
      e: item.espacos.slice(0, CONFIG.ESPACOS_NO_CALENDARIO)
    };
  });

  const bloqueios = {};       // dia inteiro: { data: { motivo } }
  const bloqueiosTurno = {};  // só alguns turnos: { data: [ { turno, motivo } ] }
  lerBloqueios_().forEach(function (b) {
    if (b.data < ini || b.data > fim) return;
    if (!b.turno) bloqueios[b.data] = { motivo: b.motivo };
    else (bloqueiosTurno[b.data] = bloqueiosTurno[b.data] || []).push({ turno: b.turno, motivo: b.motivo });
  });
  Object.keys(bloqueios).forEach(function (d) { delete bloqueiosTurno[d]; });

  return {
    hoje: hojeStr_(),
    periodoInicio: ini,
    periodoFim: fim,
    resumo: resumo,
    bloqueios: bloqueios,
    bloqueiosTurno: bloqueiosTurno
  };
}

/**
 * Detalhes de um dia para o painel lateral, AGRUPADOS POR ESPAÇO.
 * Não expõe nome nem telefone de quem reservou.
 */
function getDetalhesDia(token, data) {
  const emailUsuario = validarSessao_(token);
  data = normalizarData_(data);
  const ordemTurno = {};
  listarTurnos_().forEach(function (t, i) { ordemTurno[t] = i; });

  const reservas = lerReservas_()
    .filter(function (r) { return r.data === data; })
    .map(function (r) {
      return { espaco: r.espaco, turno: r.turno, pastoral: r.pastoral,
        mesas: r.mesas, cadeiras: r.cadeiras, minha: r.email === emailUsuario };
    })
    .sort(function (a, b) {
      const d = a.espaco.localeCompare(b.espaco, 'pt-BR');
      return d !== 0 ? d : (ordemTurno[a.turno] || 0) - (ordemTurno[b.turno] || 0);
    });

  const bd = bloqueiosDoDia_(data);
  const bloqueiosTurno = bd.diaTodo ? [] : bd.lista
    .filter(function (b) { return b.turno; })
    .map(function (b) { return { turno: b.turno, motivo: b.motivo, observacao: b.observacao }; })
    .sort(function (a, b) { return (ordemTurno[a.turno] || 0) - (ordemTurno[b.turno] || 0); });
  return { data: data, reservas: reservas, bloqueio: bd.diaTodo, bloqueiosTurno: bloqueiosTurno };
}

// ============================================================================
// CANCELAMENTO E ALTERAÇÃO DE RESERVA (sempre com registro na aba de histórico)
// ============================================================================
/**
 * Reservas do próprio usuário numa data. Retorna também se o dia ainda permite
 * cancelar (até o dia anterior) e alterar (até o dia anterior e não bloqueado).
 */
function getMinhasReservas(token, data) {
  const email = validarSessao_(token);
  data = normalizarData_(data);
  if (!data) return { ok: false, mensagem: 'Informe a data da reserva.' };

  const hoje = hojeStr_();
  const futura = data > hoje; // regra: só até o dia ANTERIOR à data da reserva
  const erroAlteracao = futura ? validarDataReserva_(data)
    : 'Alterações só podem ser feitas até o dia anterior à data da reserva.';
  const ordemTurno = {};
  listarTurnos_().forEach(function (t, i) { ordemTurno[t] = i; });

  const reservas = lerReservas_()
    .filter(function (r) { return r.data === data && r.email === email; })
    .map(function (r) {
      return { turno: r.turno, espaco: r.espaco, pastoral: r.pastoral, motivo: r.motivo,
        mesas: r.mesas, cadeiras: r.cadeiras };
    })
    .sort(function (a, b) {
      const d = a.espaco.localeCompare(b.espaco, 'pt-BR');
      return d !== 0 ? d : (ordemTurno[a.turno] || 0) - (ordemTurno[b.turno] || 0);
    });

  return {
    ok: true,
    data: data,
    reservas: reservas,
    podeCancelar: futura,
    podeAlterar: futura && !erroAlteracao,
    aviso: futura ? (erroAlteracao || '')
      : 'Alterações e cancelamentos só podem ser feitos até o dia anterior à data da reserva. Fale com o Patrimônio ' + CONFIG.CONTATO_SUPORTE + '.'
  };
}

/**
 * Cancela a reserva: PRIMEIRO copia a linha para a aba Alteracao_Cancelamento,
 * DEPOIS apaga a linha da aba Reservas.
 * `dados` = { data, turno, espaco }
 */
function cancelarReserva(token, dados) {
  const email = validarSessao_(token);
  const d = dados || {};
  const data = normalizarData_(d.data);
  const turno = txt_(d.turno), espaco = txt_(d.espaco);
  if (!data || !turno || !espaco) {
    return { ok: false, codigo: 'VALIDACAO', mensagem: 'Escolha a reserva que deseja cancelar.' };
  }
  if (data <= hojeStr_()) {
    return { ok: false, codigo: 'VALIDACAO',
      mensagem: 'O cancelamento só pode ser feito até o dia anterior à data da reserva. Fale com o Patrimônio ' + CONFIG.CONTATO_SUPORTE + '.' };
  }

  const lock = LockService.getScriptLock();
  try { lock.waitLock(30000); }
  catch (e) {
    return { ok: false, codigo: 'OCUPADO', mensagem: 'O sistema está ocupado. Aguarde alguns segundos e tente de novo.' };
  }

  try {
    const achado = acharLinhaReserva_(data, turno, espaco);
    if (!achado) {
      return { ok: false, codigo: 'NAO_ENCONTRADA',
        mensagem: 'Esta reserva não foi encontrada. Ela pode já ter sido cancelada.' };
    }
    if (achado.dono !== email) {
      return { ok: false, codigo: 'SEM_PERMISSAO',
        mensagem: 'Esta reserva foi feita por outra pessoa. Só quem reservou pode cancelar.' };
    }
    // 1º registro para auditoria; 2º exclusão. Se o registro falhar, nada é apagado.
    registrarHistorico_('Cancelamento', achado.valores, email, 'Reserva cancelada pelo coordenador.');
    obterAba_(CONFIG.ABA_RESERVAS, CAB_RESERVAS).deleteRow(achado.linha);
    SpreadsheetApp.flush();
    return { ok: true, codigo: 'OK', mensagem: 'Reserva cancelada.',
      reserva: { data: data, turno: turno, espaco: espaco } };
  } catch (e) {
    console.error(e);
    return { ok: false, codigo: 'ERRO', mensagem: 'Não foi possível cancelar agora. Tente novamente.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Altera espaço, turno, motivo e (no Externo) mesas/cadeiras. A DATA não muda
 * (para trocar de dia, o usuário cancela e faz uma nova reserva).
 * PRIMEIRO copia a reserva anterior para a aba Alteracao_Cancelamento,
 * DEPOIS grava os novos dados na aba Reservas.
 * `dados` = { data, turno, espaco, novoTurno, novoEspaco, novoMotivo, novoObjetos }
 */
function alterarReserva(token, dados) {
  const email = validarSessao_(token);
  const d = dados || {};
  const data = normalizarData_(d.data);
  const turno = txt_(d.turno), espaco = txt_(d.espaco);
  const novoTurno = txt_(d.novoTurno), novoEspaco = txt_(d.novoEspaco);
  const novoMotivo = txt_(d.novoMotivo);

  if (!data || !turno || !espaco) {
    return { ok: false, codigo: 'VALIDACAO', mensagem: 'Escolha a reserva que deseja alterar.' };
  }
  if (data <= hojeStr_()) {
    return { ok: false, codigo: 'VALIDACAO',
      mensagem: 'A alteração só pode ser feita até o dia anterior à data da reserva. Fale com o Patrimônio ' + CONFIG.CONTATO_SUPORTE + '.' };
  }
  if (listarTurnos_().indexOf(novoTurno) === -1) {
    return { ok: false, codigo: 'VALIDACAO', mensagem: 'Selecione um turno válido.' };
  }
  if (listarEspacos_().indexOf(novoEspaco) === -1) {
    return { ok: false, codigo: 'VALIDACAO', mensagem: 'Selecione um espaço válido.' };
  }
  if (novoMotivo.length < CONFIG.MOTIVO_MIN || novoMotivo.length > CONFIG.MOTIVO_MAX) {
    return { ok: false, codigo: 'VALIDACAO',
      mensagem: 'O motivo deve ter entre ' + CONFIG.MOTIVO_MIN + ' e ' + CONFIG.MOTIVO_MAX + ' caracteres.' };
  }

  const lock = LockService.getScriptLock();
  try { lock.waitLock(30000); }
  catch (e) {
    return { ok: false, codigo: 'OCUPADO', mensagem: 'O sistema está ocupado. Aguarde alguns segundos e tente de novo.' };
  }

  try {
    const erroData = validarDataReserva_(data);
    if (erroData) return { ok: false, codigo: 'CONFLITO', mensagem: erroData };

    const achado = acharLinhaReserva_(data, turno, espaco);
    if (!achado) {
      return { ok: false, codigo: 'NAO_ENCONTRADA',
        mensagem: 'Esta reserva não foi encontrada. Ela pode já ter sido cancelada.' };
    }
    if (achado.dono !== email) {
      return { ok: false, codigo: 'SEM_PERMISSAO',
        mensagem: 'Esta reserva foi feita por outra pessoa. Só quem reservou pode alterar.' };
    }

    const v = achado.valores;
    const antes = {
      motivo: txt_(v[COL_MOTIVO - 1]),
      mesas: qtdLida_(v[COL_MESAS - 1]),
      cadeiras: qtdLida_(v[COL_CADEIRAS - 1])
    };
    const obj = lerObjetos_(novoEspaco, d.novoObjetos,
      ehExterno_(espaco) ? { mesas: antes.mesas, cadeiras: antes.cadeiras } : null);
    if (obj.erro) return { ok: false, codigo: 'VALIDACAO', mensagem: obj.erro };

    const mudouLugar = norm_(novoTurno) !== norm_(turno) || norm_(novoEspaco) !== norm_(espaco);
    if (mudouLugar) {
      const bloqTurno = bloqueioDoTurno_(data, novoTurno);
      if (bloqTurno) {
        return { ok: false, codigo: 'CONFLITO', mensagem: ehDiaInteiro_(novoTurno)
          ? 'Não é possível reservar o dia inteiro: o turno ' + bloqTurno.turnoOriginal +
            ' está bloqueado nesta data (' + bloqTurno.motivo + ').'
          : 'O turno ' + novoTurno + ' está bloqueado nesta data: ' + bloqTurno.motivo };
      }
      // Ignora a própria reserva ao conferir o conflito
      const ocupacao = ocupacaoDoDia_(data, { turno: turno, espaco: espaco });
      const conflito = conflitoReserva_(ocupacao, novoTurno, novoEspaco);
      if (conflito) {
        return { ok: false, codigo: 'CONFLITO', mensagem: mensagemConflito_(conflito, novoEspaco, novoTurno) };
      }
    }

    // O que mudou (vai para a coluna Detalhe do histórico)
    const mudancas = [];
    if (norm_(novoTurno) !== norm_(turno)) mudancas.push('Turno: ' + turno + ' → ' + novoTurno);
    if (norm_(novoEspaco) !== norm_(espaco)) mudancas.push('Espaço: ' + espaco + ' → ' + novoEspaco);
    if (novoMotivo !== antes.motivo) mudancas.push('Motivo: "' + antes.motivo + '" → "' + novoMotivo + '"');
    if (obj.mesas !== antes.mesas) mudancas.push('Mesas: ' + antes.mesas + ' → ' + obj.mesas);
    if (obj.cadeiras !== antes.cadeiras) mudancas.push('Cadeiras: ' + antes.cadeiras + ' → ' + obj.cadeiras);
    if (!mudancas.length) {
      return { ok: false, codigo: 'SEM_MUDANCA', mensagem: 'Nenhuma informação foi modificada.' };
    }

    // 1º registro da reserva ANTERIOR; 2º gravação dos novos dados.
    registrarHistorico_('Alteração', v, email, mudancas.join('; '));

    const nova = v.slice(0, CAB_RESERVAS.length);
    while (nova.length < CAB_RESERVAS.length) nova.push('');
    nova[COL_TURNO - 1] = novoTurno;
    nova[COL_ESPACO - 1] = novoEspaco;
    nova[COL_MOTIVO - 1] = novoMotivo;
    nova[COL_MESAS - 1] = obj.mesas || '';
    nova[COL_CADEIRAS - 1] = obj.cadeiras || '';
    // Regrava da coluna B (Turno) até K (Cadeiras); a Data (coluna A) não é tocada.
    const aba = obterAba_(CONFIG.ABA_RESERVAS, CAB_RESERVAS);
    aba.getRange(achado.linha, COL_TURNO, 1, COL_CADEIRAS - COL_TURNO + 1)
      .setValues([nova.slice(COL_TURNO - 1, COL_CADEIRAS)]);
    SpreadsheetApp.flush();

    return { ok: true, codigo: 'OK', mensagem: 'Reserva alterada!',
      reserva: { data: data, turno: novoTurno, espaco: novoEspaco,
        pastoral: txt_(v[3]), motivo: novoMotivo, mesas: obj.mesas, cadeiras: obj.cadeiras } };
  } catch (e) {
    console.error(e);
    return { ok: false, codigo: 'ERRO', mensagem: 'Não foi possível alterar agora. Tente novamente.' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Copia a reserva (como estava ANTES da operação) para a aba Alteracao_Cancelamento.
 * Colunas: Tipo | Timestamp_Operacao | Email_Operador | Detalhe | <colunas da aba Reservas>
 */
function registrarHistorico_(tipo, valores, emailOperador, detalhe) {
  const aba = obterAba_(CONFIG.ABA_HISTORICO, CAB_HISTORICO);
  const anterior = CAB_RESERVAS.map(function (_, i) {
    const x = valores[i];
    return x === null || x === undefined ? '' : x;
  });
  anterior[0] = dataBr_(normalizarData_(anterior[0])) || txt_(anterior[0]);

  const linha = aba.getLastRow() + 1;
  aba.getRange(linha, 2).setNumberFormat('dd/MM/yyyy HH:mm:ss');                 // Timestamp_Operacao
  aba.getRange(linha, HIST_PREFIXO + 1).setNumberFormat('@');                    // Data
  aba.getRange(linha, HIST_PREFIXO + 6).setNumberFormat('@');                    // Contato_WhatsApp
  aba.getRange(linha, HIST_PREFIXO + 8).setNumberFormat('dd/MM/yyyy HH:mm:ss');  // Timestamp_Reserva
  aba.getRange(linha, 1, 1, CAB_HISTORICO.length).setValues([
    [tipo, new Date(), String(emailOperador || '').toLowerCase(), detalhe || ''].concat(anterior)
  ]);
  SpreadsheetApp.flush(); // garante o registro antes de mexer na reserva
}

/**
 * Localiza a linha da reserva na planilha por data + turno + espaço
 * (combinação única, porque o sistema não permite duas reservas iguais).
 * Retorna { linha, dono, valores } ou null.
 */
function acharLinhaReserva_(data, turno, espaco) {
  const aba = obterAba_(CONFIG.ABA_RESERVAS, CAB_RESERVAS);
  const ultima = aba.getLastRow();
  if (ultima < 2) return null;
  const valores = aba.getRange(2, 1, ultima - 1, CAB_RESERVAS.length).getValues();
  for (let i = 0; i < valores.length; i++) {
    const l = valores[i];
    if (normalizarData_(l[0]) === data &&
        norm_(l[1]) === norm_(turno) &&
        norm_(l[2]) === norm_(espaco)) {
      return { linha: i + 2, dono: txt_(l[COL_EMAIL - 1]).toLowerCase(), valores: l };
    }
  }
  return null;
}

// ============================================================================
// LEITURA DA PLANILHA
// ============================================================================
function planilha_() {
  return CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Abre a aba (cria com o cabeçalho se não existir).
 * `manterCabecalho` = true: nunca reescreve o cabeçalho de uma aba que já existe
 * (usado na aba Autorizados, cujas colunas podem estar em qualquer ordem).
 */
function obterAba_(nome, cabecalho, manterCabecalho) {
  const ss = planilha_();
  let aba = ss.getSheetByName(nome);
  if (!aba) {
    aba = ss.insertSheet(nome);
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold');
    aba.setFrozenRows(1);
  } else if (!manterCabecalho && aba.getLastColumn() < cabecalho.length) {
    // Aba antiga com menos colunas (ex.: Reservas da V3): completa o cabeçalho.
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold');
  }
  return aba;
}

function lerLinhas_(nome, cabecalho) {
  const aba = obterAba_(nome, cabecalho);
  const ultima = aba.getLastRow();
  if (ultima < 2) return [];
  return aba.getRange(2, 1, ultima - 1, cabecalho.length).getValues();
}

function lerReservas_() {
  return lerLinhas_(CONFIG.ABA_RESERVAS, CAB_RESERVAS)
    .map(function (l) {
      return {
        data: normalizarData_(l[0]),
        turno: txt_(l[1]),
        espaco: txt_(l[2]),
        pastoral: txt_(l[3]),
        motivo: txt_(l[6]),
        email: txt_(l[8]).toLowerCase(),
        mesas: qtdLida_(l[COL_MESAS - 1]),
        cadeiras: qtdLida_(l[COL_CADEIRAS - 1])
      };
    })
    .filter(function (r) { return r.data && r.turno && r.espaco; });
}

// ============================================================================
// BLOQUEIOS (dia inteiro, por turno, por período e por dia da semana)
// ============================================================================
let bloqueiosEmMemoria_ = null; // evita reler a aba várias vezes na mesma chamada

/**
 * Lê a aba Bloqueios e devolve uma lista "expandida", uma entrada por data:
 *   { data: 'yyyy-MM-dd', turno: '' (dia todo) ou nome do turno, motivo, observacao }
 */
function lerBloqueios_() {
  if (bloqueiosEmMemoria_) return bloqueiosEmMemoria_;
  const saida = [];
  lerLinhas_(CONFIG.ABA_BLOQUEIOS, CAB_BLOQUEIOS).forEach(function (l, i) {
    const inicio = normalizarData_(l[0]);
    if (!inicio) return;
    const motivo = txt_(l[1]) || 'Bloqueio administrativo';
    const observacao = txt_(l[2]);
    const turnos = separarLista_(l[3]);
    const diaTodo = !turnos.length || turnos.some(ehDiaInteiro_);
    const fim = normalizarData_(l[4]) || inicio;
    const dias = lerDiasSemana_(l[5]);

    if (fim < inicio) {
      console.warn('Bloqueios, linha ' + (i + 2) + ': Ate_Data é anterior à Data. Linha ignorada.');
      return;
    }
    let d = inicio, voltas = 0;
    while (d <= fim && voltas < 800) { // limite de segurança (~2 anos)
      if (fim === inicio || !dias.length || dias.indexOf(diaSemana_(d)) !== -1) {
        if (diaTodo) {
          saida.push({ data: d, turno: '', motivo: motivo, observacao: observacao });
        } else {
          turnos.forEach(function (t) {
            saida.push({ data: d, turno: t, motivo: motivo, observacao: observacao });
          });
        }
      }
      d = addDias_(d, 1);
      voltas++;
    }
  });
  bloqueiosEmMemoria_ = saida;
  return saida;
}

/** Bloqueios de uma data: { diaTodo: bloqueio|null, lista: [bloqueios da data] }. */
function bloqueiosDoDia_(data) {
  const lista = lerBloqueios_().filter(function (b) { return b.data === data; });
  const diaTodo = lista.filter(function (b) { return !b.turno; })[0] || null;
  return { diaTodo: diaTodo, lista: lista };
}

/**
 * Bloqueio que impede reservar este turno nesta data, ou null.
 * "Dia inteiro" fica impedido se QUALQUER turno do dia estiver bloqueado.
 * Retorna { motivo, turnoOriginal }.
 */
function bloqueioDoTurno_(data, turno) {
  const bd = bloqueiosDoDia_(data);
  if (bd.diaTodo) return { motivo: bd.diaTodo.motivo, turnoOriginal: turno };
  const achado = bd.lista.filter(function (b) {
    return ehDiaInteiro_(turno) || norm_(b.turno) === norm_(turno);
  })[0];
  return achado ? { motivo: achado.motivo, turnoOriginal: achado.turno } : null;
}

/** "Tarde, Noite" / "Tarde; Noite" / "Tarde e Noite" -> ['Tarde', 'Noite'] */
function separarLista_(v) {
  return txt_(v).split(/\s*[,;\/]\s*|\s+e\s+/i)
    .map(function (x) { return x.trim(); })
    .filter(function (x) { return x; });
}

/** "Quinta" / "qui" / "Terça, Quinta" / "quinta-feira" -> [4] / [2, 4] (0=Dom ... 6=Sáb) */
function lerDiasSemana_(v) {
  const prefixos = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
  const dias = [];
  separarLista_(v).forEach(function (x) {
    const i = prefixos.indexOf(norm_(x).slice(0, 3));
    if (i !== -1 && dias.indexOf(i) === -1) dias.push(i);
  });
  return dias;
}

/** Espaços da aba Patrimonio (coluna A). Sem lista, o sistema para com aviso claro. */
function listarEspacos_() {
  const lista = lerColunaPatrimonio_(0);
  if (!lista.length) {
    throw new Error('A lista de espaços está vazia. Preencha a coluna ESPAÇO da aba "' +
      CONFIG.ABA_PATRIMONIO + '" na planilha.');
  }
  return lista;
}

/** Turnos da aba Patrimonio (coluna B). Sem lista, o sistema para com aviso claro. */
function listarTurnos_() {
  const lista = lerColunaPatrimonio_(1);
  if (!lista.length) {
    throw new Error('A lista de turnos está vazia. Preencha a coluna HORÁRIO da aba "' +
      CONFIG.ABA_PATRIMONIO + '" na planilha.');
  }
  return lista;
}

/** Lista da aba "Pastorais" (coluna A, a partir da linha 2), em ordem alfabética. */
function listarPastorais_() {
  const aba = planilha_().getSheetByName(CONFIG.ABA_PASTORAIS);
  if (!aba || aba.getLastRow() < 2) return [];
  const vistos = {};
  return aba.getRange(2, 1, aba.getLastRow() - 1, 1).getValues()
    .map(function (l) { return txt_(l[0]); })
    .filter(function (v) {
      if (!v || vistos[v]) return false;
      vistos[v] = true;
      return true;
    })
    .sort(function (a, b) { return a.localeCompare(b, 'pt-BR'); });
}

function lerColunaPatrimonio_(indice) {
  const cache = CacheService.getScriptCache();
  const chaveCache = 'patrimonio_col_' + indice;
  const emCache = cache.get(chaveCache);
  if (emCache) return JSON.parse(emCache);

  const aba = planilha_().getSheetByName(CONFIG.ABA_PATRIMONIO);
  if (!aba) {
    throw new Error('A aba "' + CONFIG.ABA_PATRIMONIO + '" não existe na planilha. ' +
      'Crie a aba com as colunas ESPAÇO e HORÁRIO (ou rode configurarPlanilha).');
  }
  if (aba.getLastRow() < 2) return [];
  const vistos = {};
  const lista = aba.getRange(2, indice + 1, aba.getLastRow() - 1, 1).getValues()
    .map(function (l) { return txt_(l[0]); })
    .filter(function (v) {
      if (!v || vistos[v]) return false;
      vistos[v] = true;
      return true;
    });
  if (lista.length) cache.put(chaveCache, JSON.stringify(lista), 600); // 10 minutos
  return lista;
}

// ============================================================================
// OCUPAÇÃO E REGRA DO "DIA INTEIRO"
// ============================================================================
/** Compara textos ignorando maiúsculas, acentos e espaços extras. */
function norm_(v) {
  return txt_(v).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').toLowerCase();
}

function ehDiaInteiro_(turno) {
  return norm_(turno) === norm_(CONFIG.TURNO_DIA_INTEIRO);
}

/**
 * Ocupação de uma data: { espacoNormalizado: { turnoNormalizado: true, ... } }.
 * `excluir` (opcional) = { turno, espaco } de uma reserva em edição, que é ignorada.
 */
function ocupacaoDoDia_(data, excluir) {
  const mapa = {};
  const exTurno = excluir && excluir.turno ? norm_(excluir.turno) : null;
  const exEspaco = excluir && excluir.espaco ? norm_(excluir.espaco) : null;
  lerReservas_().forEach(function (r) {
    if (r.data !== data) return;
    const e = norm_(r.espaco), t = norm_(r.turno);
    if (exEspaco && e === exEspaco && t === exTurno) return; // a própria reserva em edição
    (mapa[e] = mapa[e] || {})[t] = true;
  });
  return mapa;
}

/**
 * Verifica se o espaço pode ser reservado no turno. Retorna null se estiver livre,
 * ou o motivo do conflito:
 *   'DIA_INTEIRO'        – o espaço já está reservado para o dia inteiro;
 *   'TEM_RESERVA_NO_DIA' – pediu dia inteiro, mas já há reserva em algum turno;
 *   'MESMO_TURNO'        – já existe reserva neste mesmo turno.
 */
function conflitoReserva_(ocupacao, turno, espaco) {
  const turnosOcupados = ocupacao[norm_(espaco)];
  if (!turnosOcupados) return null;
  if (turnosOcupados[norm_(CONFIG.TURNO_DIA_INTEIRO)]) return 'DIA_INTEIRO';
  if (ehDiaInteiro_(turno)) return 'TEM_RESERVA_NO_DIA';
  if (turnosOcupados[norm_(turno)]) return 'MESMO_TURNO';
  return null;
}

// ============================================================================
// VALIDAÇÕES
// ============================================================================
function limparFormulario_(form) {
  return {
    data: normalizarData_(form.data),
    turno: txt_(form.turno),
    espaco: txt_(form.espaco),
    pastoral: txt_(form.pastoral).slice(0, 100),
    nome: txt_(form.nome).slice(0, 100),
    whatsapp: txt_(form.whatsapp).slice(0, 20),
    motivo: txt_(form.motivo)
  };
}

function validarFormulario_(f) {
  if (!f.data) return 'Informe a data da reserva.';
  if (listarTurnos_().indexOf(f.turno) === -1) return 'Selecione um turno válido.';
  if (listarEspacos_().indexOf(f.espaco) === -1) return 'Selecione um espaço válido.';
  if (f.pastoral.length < 2) return 'Informe a pastoral ou evento.';
  if (f.nome.length < 3) return 'Informe seu nome completo.';
  const digitos = f.whatsapp.replace(/\D/g, '');
  if (digitos.length < 10 || digitos.length > 11) return 'Informe um WhatsApp válido com DDD.';
  if (f.motivo.length < CONFIG.MOTIVO_MIN || f.motivo.length > CONFIG.MOTIVO_MAX) {
    return 'O motivo deve ter entre ' + CONFIG.MOTIVO_MIN + ' e ' + CONFIG.MOTIVO_MAX + ' caracteres.';
  }
  return null;
}

/** Retorna mensagem de erro ou null se a data pode ser reservada. */
function validarDataReserva_(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return 'Data inválida.';
  const hoje = hojeStr_();
  if (data <= hoje) return 'Não é possível reservar para hoje ou para datas passadas.';
  if (diaSemana_(hoje) === 6 && data === addDias_(hoje, 1)) {
    return 'Reservas feitas no sábado só podem ser para segunda-feira em diante.';
  }
  if (data < CONFIG.PERIODO_INICIO || data > CONFIG.PERIODO_FIM) {
    return 'Reservas aceitas somente entre ' + dataBr_(CONFIG.PERIODO_INICIO) +
      ' e ' + dataBr_(CONFIG.PERIODO_FIM) + '.';
  }
  const bloqueio = bloqueiosDoDia_(data).diaTodo;
  if (bloqueio) return 'Esta data está bloqueada: ' + bloqueio.motivo;
  return null;
}

function minDataReserva_() {
  const hoje = hojeStr_();
  const minimaPelaRegra = addDias_(hoje, diaSemana_(hoje) === 6 ? 2 : 1);
  // A data mais tardia entre a regra (amanhã/segunda) e o início do período
  return minimaPelaRegra > CONFIG.PERIODO_INICIO ? minimaPelaRegra : CONFIG.PERIODO_INICIO;
}

// ============================================================================
// UTILITÁRIOS DE DATA (sempre no fuso do script — ajuste em Configurações do projeto)
// ============================================================================
function fuso_() {
  return Session.getScriptTimeZone() || 'America/Sao_Paulo';
}

/** Data de hoje no formato interno (yyyy-MM-dd). */
function hojeStr_() {
  return Utilities.formatDate(new Date(), fuso_(), 'yyyy-MM-dd');
}

function addDias_(iso, n) {
  const p = iso.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return Utilities.formatDate(d, 'UTC', 'yyyy-MM-dd');
}

function diaSemana_(iso) {
  const p = iso.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay(); // 0=Dom ... 6=Sáb
}

/**
 * Formato interno: sempre "YYYY-MM-DD" (ano primeiro). É esse formato que permite
 * comparar datas como texto nas regras de hoje/sábado/período — NÃO troque para
 * dd-MM-yyyy aqui. Para exibir em formato brasileiro, use dataBr_().
 * Aceita Date, "YYYY-MM-DD", "DD/MM/YYYY" ou "DD-MM-YYYY".
 */
function normalizarData_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, fuso_(), 'yyyy-MM-dd');
  const s = txt_(v);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + pad_(m[2]) + '-' + pad_(m[3]);
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/); // aceita 05/10/2026 e 05-10-2026
  if (m) return m[3] + '-' + pad_(m[2]) + '-' + pad_(m[1]);
  return '';
}

function dataBr_(iso) { return iso ? iso.split('-').reverse().join('/') : ''; }
function pad_(n) { return ('0' + n).slice(-2); }
function txt_(v) { return v === null || v === undefined ? '' : String(v).trim(); }

// ============================================================================
// SETUP (rodar manualmente uma vez — e de novo ao atualizar de versão)
// ============================================================================
function configurarPlanilha() {
  const r = obterAba_(CONFIG.ABA_RESERVAS, CAB_RESERVAS);
  // Garante o cabeçalho completo (inclui Email_Usuario, Mesas, Cadeiras, Itens_Cozinha)
  r.getRange(1, 1, 1, CAB_RESERVAS.length).setValues([CAB_RESERVAS]).setFontWeight('bold');
  // Colunas de data como texto puro para evitar conversões automáticas.
  r.getRange('A:A').setNumberFormat('@');
  r.getRange('F:F').setNumberFormat('@');
  r.getRange('H:H').setNumberFormat('dd/MM/yyyy HH:mm:ss');
  r.getRange('J:K').setNumberFormat('0');

  // Histórico de alterações e cancelamentos (auditoria)
  const h = obterAba_(CONFIG.ABA_HISTORICO, CAB_HISTORICO);
  h.getRange(1, 1, 1, CAB_HISTORICO.length).setValues([CAB_HISTORICO]).setFontWeight('bold');
  h.setFrozenRows(1);
  h.getRange(1, 2, h.getMaxRows(), 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');                 // Timestamp_Operacao
  h.getRange(1, HIST_PREFIXO + 1, h.getMaxRows(), 1).setNumberFormat('@');                    // Data
  h.getRange(1, HIST_PREFIXO + 6, h.getMaxRows(), 1).setNumberFormat('@');                    // Contato
  h.getRange(1, HIST_PREFIXO + 8, h.getMaxRows(), 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');  // Timestamp_Reserva

  const b = obterAba_(CONFIG.ABA_BLOQUEIOS, CAB_BLOQUEIOS);
  b.getRange(1, 1, 1, CAB_BLOQUEIOS.length).setValues([CAB_BLOQUEIOS]).setFontWeight('bold');
  b.getRange('A:A').setNumberFormat('@');
  b.getRange('E:E').setNumberFormat('@');
  obterAba_(CONFIG.ABA_PASTORAIS, ['Pastoral']);
  // Cria a aba Patrimonio (só o cabeçalho) se ainda não existir. Preencha à mão.
  obterAba_(CONFIG.ABA_PATRIMONIO, CAB_PATRIMONIO);

  // Autorizados: só acrescenta as colunas que faltam; não mexe nas existentes.
  prepararAutorizados_();
  const dono = Session.getEffectiveUser().getEmail().toLowerCase();
  if (!buscarAutorizado_(dono)) {
    adicionarAutorizado_({ email: dono, pastoral: 'Administrador', pin: novoPin_(), ativo: 'SIM' });
  }
  gerarPinsFaltantes();

  limparCache();
  try {
    const espacos = listarEspacos_();
    Logger.log('Espaços: ' + espacos.length + ' | Turnos: ' + listarTurnos_().join(', '));
    if (!espacos.some(ehExterno_)) {
      Logger.log('ATENÇÃO: o espaço "' + CONFIG.ESPACO_EXTERNO + '" não está na aba Patrimonio. ' +
        'A pergunta de mesas e cadeiras não vai aparecer.');
    }
  } catch (e) {
    Logger.log('ATENÇÃO: ' + e.message);
  }
}

/**
 * Garante que a aba Autorizados tenha as colunas Email, Pastoral, Nome, WhatsApp,
 * PIN e Ativo. As que faltarem são criadas NO FIM do cabeçalho.
 */
function prepararAutorizados_() {
  let a = mapaAutorizados_();
  const faltando = Object.keys(COLS_AUTORIZADOS).filter(function (c) { return a.mapa[c] < 0; });
  if (faltando.length) {
    // Primeira coluna livre (se a aba tem só o cabeçalho vazio, começa na A)
    const cabAtual = a.aba.getRange(1, 1, 1, a.largura).getValues()[0];
    let col = cabAtual.some(function (x) { return txt_(x); }) ? a.largura + 1 : 1;
    faltando.forEach(function (c) {
      a.aba.getRange(1, col).setValue(COLS_AUTORIZADOS[c][0]).setFontWeight('bold');
      Logger.log('Aba Autorizados: coluna "' + COLS_AUTORIZADOS[c][0] + '" criada.');
      col++;
    });
    a = mapaAutorizados_();
  }
  // PIN e WhatsApp como texto, para não perder zeros nem virar notação científica
  const linhas = a.aba.getMaxRows();
  a.aba.getRange(1, a.mapa.pin + 1, linhas, 1).setNumberFormat('@');
  a.aba.getRange(1, a.mapa.whatsapp + 1, linhas, 1).setNumberFormat('@');
  a.aba.setFrozenRows(1);
}

/** Acrescenta uma pessoa na aba Autorizados, cada dado na coluna certa. */
function adicionarAutorizado_(dados) {
  const a = mapaAutorizados_();
  const linha = new Array(a.largura).fill('');
  Object.keys(dados).forEach(function (campo) {
    if (a.mapa[campo] >= 0) linha[a.mapa[campo]] = dados[campo];
  });
  a.aba.appendRow(linha);
}

/** Gera um PIN de 6 dígitos para quem ainda não tem, na aba Autorizados. */
function gerarPinsFaltantes() {
  const a = mapaAutorizados_();
  const m = a.mapa;
  if (m.email < 0 || m.pin < 0) {
    Logger.log('A aba Autorizados precisa das colunas Email e PIN. Rode configurarPlanilha().');
    return;
  }
  const ultima = a.aba.getLastRow();
  if (ultima < 2) return;
  const valores = a.aba.getRange(2, 1, ultima - 1, a.largura).getValues();
  const pins = [], ativos = [];
  let mudou = false;
  valores.forEach(function (l) {
    let pin = l[m.pin], ativo = m.ativo >= 0 ? l[m.ativo] : '';
    if (txt_(l[m.email]) && !txt_(pin)) { pin = novoPin_(); mudou = true; }
    if (txt_(l[m.email]) && m.ativo >= 0 && !txt_(ativo)) { ativo = 'SIM'; mudou = true; }
    pins.push([pin]);
    ativos.push([ativo]);
  });
  // Grava só as colunas PIN e Ativo (as demais ficam intactas, inclusive fórmulas)
  if (mudou) {
    const faixaPin = a.aba.getRange(2, m.pin + 1, pins.length, 1);
    faixaPin.setNumberFormat('@');
    faixaPin.setValues(pins);
    if (m.ativo >= 0) a.aba.getRange(2, m.ativo + 1, ativos.length, 1).setValues(ativos);
  }
  Logger.log(valores.map(function (l, i) { return [l[m.email], pins[i][0]]; })
    .filter(function (x) { return txt_(x[0]); })
    .map(function (x) { return x[0] + ' → PIN ' + x[1]; }).join('\n'));
}

function novoPin_() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** Rode no editor para conferir o que o sistema lê da aba Autorizados. */
function testarAutorizados() {
  const a = mapaAutorizados_();
  Logger.log('Colunas encontradas (A = 1): ' + Object.keys(a.mapa).map(function (k) {
    return k + '=' + (a.mapa[k] >= 0 ? a.mapa[k] + 1 : 'NÃO ENCONTRADA');
  }).join(', '));
  lerAutorizados_().forEach(function (p) {
    if (!p.email) return;
    Logger.log(p.email + ' → cabeçalho: "' + rotuloUsuario_(p) + '" | WhatsApp: ' +
      (p.whatsapp || '(vazio)') + (p.ativo ? '' : ' | INATIVO'));
  });
}

/** Desconecta todos os aparelhos (todos precisarão digitar e-mail e PIN de novo). */
function encerrarTodasAsSessoes() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).forEach(function (k) {
    if (k.indexOf('ss_') === 0) props.deleteProperty(k);
  });
  Logger.log('Todas as sessões foram encerradas.');
}

/** Rode após editar a aba Patrimonio para atualizar a lista na hora. */
function limparCache() {
  CacheService.getScriptCache().removeAll(['patrimonio_col_0', 'patrimonio_col_1']);
}
