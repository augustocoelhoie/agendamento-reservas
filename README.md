# Reservas de Espaços

Sistema de autoatendimento para reservar salas, salões e áreas externas de uma instituição, sem servidor próprio e com custo zero. Os coordenadores entram com **e-mail + PIN**, escolhem a data e veem na hora o que ainda está livre. A administração acompanha tudo por um calendário e por um histórico de auditoria.

Feito com **Google Apps Script**, **Google Sheets** (como banco de dados) e uma interface em **HTML + Tailwind CSS + JavaScript puro**.

> Os rótulos da interface estão em português e falam de "pastorais", porque o sistema nasceu numa paróquia. Para outro contexto (escola, coworking, associação), troque os textos no `Index.html`.

## O que ele faz

- **Reserva em tempo real:** só aparecem os espaços e turnos que ainda estão livres na data escolhida; a lista se atualiza sozinha a cada 45 segundos.
- **Sem reservas duplicadas:** a gravação usa trava de concorrência (`LockService`) e confere a planilha de novo dentro da trava. Dois cliques simultâneos no mesmo espaço não geram duas reservas.
- **Regras de data:** não reserva para hoje nem para o passado; reserva feita no sábado só vale de segunda-feira em diante; período configurável (por padrão, 2 anos).
- **Turno "Dia inteiro":** só pode ser reservado se o espaço estiver livre em todos os turnos, e bloqueia todos os turnos depois de reservado.
- **Bloqueios flexíveis:** dia inteiro, só alguns turnos, intervalos de datas e dias da semana (ex.: todas as quintas de outubro à noite).
- **Alterar e cancelar** até o dia anterior à reserva, só pelo próprio dono. Cada operação grava antes uma cópia da reserva original numa aba de histórico.
- **Mesas e cadeiras** para um espaço externo, com limites configuráveis.
- **Calendário geral** de vários anos, com painel lateral por dia que **não expõe nome nem telefone** de quem reservou.
- **Acessibilidade:** fonte grande, alto contraste, navegação por teclado e foco visível, pensado para públicos de todas as idades.

<img width="543" height="797" alt="image" src="https://github.com/user-attachments/assets/207e7193-7a19-4f05-8616-b32c8af8482d" />
<img width="517" height="858" alt="image" src="https://github.com/user-attachments/assets/a7eaec5e-3908-46cb-ba6c-04234cb9a5b0" />
<img width="645" height="546" alt="image" src="https://github.com/user-attachments/assets/12b10981-84ac-456b-b6f7-fccc8709910d" />


## Segurança em resumo

- A planilha continua **privada**: o script roda com a conta do administrador e o usuário nunca a abre.
- Login por e-mail + PIN, sem exigir conta Google (funciona em celulares com várias contas conectadas).
- Bloqueio do e-mail após 4 PINs errados, com atraso artificial nas tentativas falhas.
- Sessões com token aleatório; só o **hash** do token fica guardado no servidor, e a sessão expira (60 dias por padrão).
- O PIN nunca é enviado de volta ao navegador.
- Toda entrada é validada no servidor, e a saída é escapada no navegador contra XSS.

Detalhes e limitações honestas em [`docs/SEGURANCA.md`](docs/SEGURANCA.md).

## Estrutura do repositório

```
reservas-espacos/
├── apps-script/
│   ├── Backend.gs          # API, regras de negócio, login, leitura/escrita na planilha
│   ├── Index.html          # Interface servida pelo próprio Apps Script
│   └── appsscript.json     # Manifesto (fuso horário e acesso ao App da Web)
├── site/
│   ├── index.html          # A mesma interface para hospedar em qualquer domínio
│   └── config.example.js   # Copie para config.js e preencha
├── sheet-template/
│   ├── reservas-espacos-modelo.xlsx   # Planilha-modelo com dados fictícios
│   └── *.csv                          # Uma aba por arquivo, para importar
└── docs/
    ├── ARQUITETURA.md
    ├── IMPLANTACAO.md
    ├── REGRAS-DE-NEGOCIO.md
    └── SEGURANCA.md
```

## Duas formas de usar a interface

| | `apps-script/Index.html` | `site/index.html` |
|---|---|---|
| Onde roda | No endereço do próprio App da Web | Em qualquer domínio ou hospedagem estática |
| Comunicação | `google.script.run` | `fetch` (POST) com reserva automática por JSONP |
| Configuração | `CONFIG` no `Backend.gs` | `site/config.js` |
| Quando usar | Mais simples, um passo só | Quando você quer endereço e domínio próprios |

## Como instalar (resumo)

1. Importe `sheet-template/reservas-espacos-modelo.xlsx` no Google Sheets.
2. Em **Extensões > Apps Script**, cole os arquivos de `apps-script/` e ajuste o bloco `CONFIG` do `Backend.gs`.
3. Rode `configurarPlanilha()` uma vez e anote os PINs gerados no registro de execução.
4. **Implantar > Nova implantação > App da Web** (executar como *Eu*, acesso *Qualquer pessoa*).
5. Se usar a página estática: copie `site/config.example.js` para `site/config.js`, preencha a URL `/exec` e publique a pasta `site/` onde quiser.

Passo a passo completo em [`docs/IMPLANTACAO.md`](docs/IMPLANTACAO.md).

## Tecnologias

Google Apps Script (V8) · Google Sheets · HTML5 · Tailwind CSS (CDN) · JavaScript (ES2020) · [flatpickr](https://flatpickr.js.org/)

## Limites conhecidos

- Pensado para uso de **centenas de pessoas**, não de milhares simultâneas: o Apps Script tem cotas diárias e o Sheets é lido a cada consulta.
- O Tailwind e o flatpickr são carregados por CDN, então a página precisa de internet.
- Não envia e-mails de confirmação (ideia de evolução).

## Ideias de evolução

- Confirmação por e-mail ou WhatsApp.
- Itens de cozinha na reserva (a coluna `Itens_Cozinha` já existe, vazia).
- Painel administrativo para gerir bloqueios e autorizados dentro da própria interface.
- Testes automatizados das regras de negócio fora do Apps Script.

## Licença

[MIT](LICENSE)
