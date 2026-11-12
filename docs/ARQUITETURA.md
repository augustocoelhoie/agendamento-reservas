# Arquitetura

## Visão geral

```
┌──────────────────────┐        POST { acao, args }        ┌──────────────────────────┐
│  Navegador           │ ────────────────────────────────▶ │  Apps Script (Web App)   │
│  index.html          │                                   │  Backend.gs              │
│  (Tailwind + JS)     │ ◀──────────────────────────────── │  executa como o dono     │
└──────────────────────┘        { ok, dados | erro }       └────────────┬─────────────┘
                                                                        │ SpreadsheetApp
                                                                        ▼
                                                           ┌──────────────────────────┐
                                                           │  Google Sheets (privada) │
                                                           │  banco de dados          │
                                                           └──────────────────────────┘
```

Não há servidor próprio. O **Apps Script** faz o papel de API e de camada de regras. O **Google Sheets** faz o papel de banco de dados, e o dono pode ver e corrigir tudo diretamente na planilha.

## Componentes

### `apps-script/Backend.gs`
- `doGet` / `doPost`: pontos de entrada. Sem parâmetros, `doGet` entrega a página; com `?acao=`, responde como API (usado só pelo caminho reserva JSONP).
- `executarAcao_`: **lista fechada** de ações aceitas (`fazerLogin`, `salvarReserva`, `getDisponibilidade` etc.). Qualquer outro nome é rejeitado.
- Login e sessão: `fazerLogin`, `criarSessao_`, `validarSessao_`.
- Regras: `validarDataReserva_`, `conflitoReserva_`, `bloqueioDoTurno_`, `lerBloqueios_`.
- Escrita: `salvarReserva`, `alterarReserva`, `cancelarReserva`, todas dentro de `LockService`.
- Setup: `configurarPlanilha()` cria abas, formatos e PINs que faltam.

### `apps-script/Index.html` e `site/index.html`
Interface de página única (login, formulário, calendário, painel lateral e janela de alterar/cancelar). A diferença entre as duas é só a camada de comunicação:

- `Index.html` chama o servidor com `google.script.run`.
- `site/index.html` chama a URL `/exec` com `fetch` (POST em `text/plain`, para evitar a verificação prévia de CORS). Se o navegador ou a rede bloquearem, cai automaticamente para JSONP.

### Planilha

| Aba | Quem escreve | Conteúdo |
|---|---|---|
| `Reservas` | Sistema | Uma linha por reserva |
| `Alteracao_Cancelamento` | Sistema | Cópia da reserva **anterior** a cada alteração ou cancelamento |
| `Bloqueios` | Administrador | Datas e turnos indisponíveis |
| `Patrimonio` | Administrador | Lista de espaços (coluna A) e turnos (coluna B) |
| `Pastorais` | Administrador | Lista de grupos do formulário |
| `Autorizados` | Administrador | E-mail, nome, grupo, WhatsApp, PIN e ativo |

A aba `Autorizados` é lida **pelo nome do cabeçalho**, então a ordem das colunas não importa.

## Decisões de projeto

**Trava de concorrência.** Verificar a disponibilidade na tela não basta: duas pessoas podem confirmar o mesmo espaço quase ao mesmo tempo. Por isso `salvarReserva` pede o `LockService`, **relê a planilha dentro da trava** e só então grava. Quem chega segundo recebe uma mensagem amigável pedindo para escolher outra opção.

**Data em formato interno `yyyy-MM-dd`.** Esse formato permite comparar datas como texto (hoje, sábado, período). Na planilha a data é gravada como texto `dd/MM/yyyy`, para o Sheets não converter sozinho. A função `normalizarData_` aceita os dois formatos.

**Timestamp no servidor.** O horário da reserva vem de `new Date()` no Apps Script, nunca do navegador.

**Auditoria antes da mudança.** Em `alterarReserva` e `cancelarReserva`, o registro no histórico é feito e confirmado (`flush`) **antes** de mexer na reserva. Se o registro falhar, nada é apagado.

**Cache onde dói.** A lista de espaços e turnos fica em `CacheService` por 10 minutos. A planilha é relida por chamada, e os bloqueios ficam em memória durante uma mesma chamada.

**Sessão sem Google.** Em vez de exigir login Google (que falha em celulares com mais de uma conta), o sistema usa e-mail + PIN e um token aleatório guardado no navegador.

## Fluxo de uma reserva

1. A pessoa escolhe a data. O navegador chama `getDisponibilidade`.
2. O servidor valida a data, soma reservas e bloqueios e devolve `{turno: [espaços livres]}`.
3. A pessoa preenche o formulário e confirma. O navegador valida e chama `salvarReserva`.
4. O servidor valida de novo, toma a trava, confere o conflito mais uma vez e grava a linha.
5. A resposta volta como `OK`, `CONFLITO`, `VALIDACAO` ou `OCUPADO`, e a interface reage a cada uma.
