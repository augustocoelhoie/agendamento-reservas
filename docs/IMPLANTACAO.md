# Implantação passo a passo

Tempo estimado: 20 a 30 minutos. Custo: zero (precisa só de uma conta Google).

## 1. Criar a planilha

1. Abra o Google Sheets e escolha **Arquivo > Importar > Upload**.
2. Envie `sheet-template/reservas-espacos-modelo.xlsx` e escolha **Criar nova planilha**.
3. Dê o nome que quiser. O nome da planilha não importa para o código; o das **abas** importa e deve ficar como está.

Se preferir, crie uma planilha vazia e importe cada `.csv` de `sheet-template/` como uma aba, com **Inserir nova(s) planilha(s)** e o nome do arquivo sem `.csv`.

## 2. Colocar o código no Apps Script

1. Na planilha, abra **Extensões > Apps Script**.
2. Apague o conteúdo do arquivo `Código.gs` e cole o de `apps-script/Backend.gs`. Renomeie o arquivo para `Backend` se quiser.
3. Crie um arquivo **HTML** chamado exatamente `Index` (o código o chama por esse nome) e cole `apps-script/Index.html`.
4. Em **Configurações do projeto**, marque **Mostrar o arquivo de manifesto "appsscript.json"** e substitua o conteúdo pelo de `apps-script/appsscript.json`. Ajuste o `timeZone` se necessário.

## 3. Ajustar o `CONFIG`

No topo do `Backend.gs`:

| Chave | O que fazer |
|---|---|
| `NOME_INSTITUICAO` | Nome exibido no topo da página |
| `CONTATO_SUPORTE` | Telefone ou e-mail mostrado nas mensagens de erro |
| `LOGO_FILE_ID` | ID de um arquivo de imagem no Drive (o trecho entre `/d/` e `/view` do link). Deixe vazio para ficar sem logo |
| `ESPACO_EXTERNO` | Nome do espaço que habilita mesas e cadeiras (igual ao da aba `Patrimonio`) |
| `PERIODO_INICIO` / `PERIODO_FIM` | Período em que as reservas são aceitas |
| `DIAS_SESSAO` | Dias que o aparelho fica conectado |

Sobre a logo: o próprio sistema lê a imagem no Drive com a conta do dono e a embute na página, então o arquivo **não precisa ser público**. Prefira uma imagem leve (abaixo de 1 MB). Depois de trocar a imagem, rode `limparCacheLogo()`.

## 4. Preparar a planilha

1. No editor do Apps Script, escolha a função `configurarPlanilha` e clique em **Executar**. Autorize o acesso quando o Google pedir.
2. Abra **Execuções > Registro** e anote os **PINs gerados**. A função adiciona o e-mail do dono como administrador e cria um PIN de 6 dígitos para quem ainda não tem.
3. Na aba `Autorizados`, troque os e-mails de exemplo pelos reais e preencha pastoral, nome e WhatsApp.
4. Na aba `Patrimonio`, liste seus espaços (coluna A) e turnos (coluna B). As duas listas são independentes.
5. Rode `testarAutorizados()` para conferir o que o sistema lê da aba.

> Depois de anotar os PINs, apague o histórico de execuções ou entregue-os por um canal seguro. Quem tiver acesso de leitura ao projeto vê o registro.

## 5. Publicar o App da Web

1. **Implantar > Nova implantação > App da Web**.
2. **Executar como:** *Eu*. **Quem pode acessar:** *Qualquer pessoa*.
3. Clique em **Implantar** e copie a URL que termina em `/exec`.

Pronto: a URL já abre o sistema completo (interface do `Index.html`).

> **Ao alterar o código depois**, use **Implantar > Gerenciar implantações > Editar > Nova versão**. Assim a URL continua a mesma. Uma "nova implantação" gera outra URL.

## 6. (Opcional) Usar a página estática em outro endereço

Quer um domínio próprio ou prefere hospedar a interface fora do Google?

1. Copie `site/config.example.js` para `site/config.js`.
2. Preencha `API_URL` (a URL `/exec` do passo 5) e `NOME_INSTITUICAO`.
3. Publique o conteúdo da pasta `site/` em **qualquer hospedagem de arquivos estáticos**, em qualquer domínio.

Cuidados na hospedagem:

- Use nomes de arquivo **em minúsculas** (`index.html`, `config.js`). Muitos servidores diferenciam maiúsculas de minúsculas, e o Windows não.
- Publique `index.html` e `config.js` na **mesma pasta**.
- Se mudar a URL do App da Web, só o `config.js` precisa ser atualizado.
- Não coloque o `config.js` real no repositório (já está no `.gitignore`).

## 7. Testar

1. Abra a página e entre com um e-mail e PIN da aba `Autorizados`.
2. Faça uma reserva para amanhã e confira a nova linha na aba `Reservas`.
3. Tente reservar o mesmo espaço e turno em outro aparelho: deve ser recusado.
4. Cancele a reserva e confira a cópia na aba `Alteracao_Cancelamento`.
5. Teste num celular com dados móveis, fora da sua rede.

## Rotinas úteis (funções do editor)

| Função | Para quê |
|---|---|
| `configurarPlanilha()` | Cria abas, formatos e PINs que faltam; rode também ao atualizar de versão |
| `gerarPinsFaltantes()` | Gera PIN para quem foi adicionado sem um |
| `testarAutorizados()` | Mostra o que o sistema entende da aba `Autorizados` |
| `testarLogo()` / `limparCacheLogo()` | Autoriza o Drive e confere a logo / limpa o cache depois de trocá-la |
| `limparCache()` | Atualiza a lista de espaços e turnos na hora, depois de editar `Patrimonio` |
| `encerrarTodasAsSessoes()` | Desconecta todos os aparelhos (todos digitam e-mail e PIN de novo) |

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "A aba Patrimonio não existe" | Nome da aba diferente do configurado, ou `configurarPlanilha()` não foi rodada |
| Página abre sem logo | `LOGO_FILE_ID` vazio ou errado; rode `testarLogo()` e veja o registro |
| 404 na hospedagem estática | Falta `index.html` na raiz publicada, ou o nome está com maiúscula |
| "Falha de conexão" na página estática | `API_URL` errada ou implantação sem acesso para *Qualquer pessoa* |
| Mudei o código e nada mudou | Faltou publicar uma **nova versão** da implantação |
| PIN zerado ou com notação científica | Coluna `PIN` sem formato de texto; rode `configurarPlanilha()` |
