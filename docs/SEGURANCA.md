# Segurança

Este documento descreve o que o sistema faz para proteger os dados e, com a mesma honestidade, onde ele **não** é forte. Ele foi pensado para uma comunidade de confiança (centenas de coordenadores), não para dados altamente sensíveis.

## O que está implementado

| Proteção | Como funciona |
|---|---|
| Planilha privada | O App da Web roda **como o dono**. Os usuários nunca recebem acesso à planilha |
| Ações em lista fechada | `executarAcao_` só executa nomes previstos; o resto é rejeitado |
| Autenticação | E-mail + PIN de 6 dígitos (só números, normalizados no servidor) |
| Limite de tentativas | 4 erros bloqueiam o e-mail por 15 minutos (`CacheService`); cada erro atrasa a resposta em 0,7 s |
| Sessão | Token aleatório (dois UUIDs). O servidor guarda só o **hash SHA-256** do token, junto com o e-mail e a validade |
| Expiração | Sessões expiram (`DIAS_SESSAO`) e são renovadas ao passar da metade do prazo |
| Desativação imediata | A cada chamada o servidor confere se o e-mail ainda está **ativo** na aba `Autorizados` |
| PIN nunca volta | O perfil enviado à página não inclui o PIN |
| Autorização por dono | Só quem criou a reserva pode alterá-la ou cancelá-la |
| Privacidade no calendário | A consulta de um dia não devolve nome nem telefone de quem reservou |
| Validação dupla | Cliente e servidor validam; o servidor é a fonte da verdade |
| Saída escapada | Todo texto vindo de usuários é escapado antes de ir para o HTML (proteção contra XSS) |
| Tamanhos limitados | Campos de texto são truncados no servidor |
| Auditoria | Alterações e cancelamentos gravam a reserva anterior, quem fez e o que mudou |
| Encerrar tudo | `encerrarTodasAsSessoes()` desconecta todos os aparelhos |

## Limitações conhecidas

- **PINs ficam em texto puro na planilha** e são comparados diretamente. Quem edita a planilha os vê. Mantenha a planilha restrita ao administrador.
- **PIN de 6 dígitos** é fraco contra ataque dedicado. O bloqueio por e-mail reduz o risco, mas não o elimina.
- **O endereço da API é público** (*Qualquer pessoa*). A proteção está no login e no token, não na URL.
- **Caminho reserva JSONP:** quando usado, os argumentos da chamada (incluindo token ou PIN) viajam na URL, e URLs podem aparecer em históricos e registros de servidores. É só um plano B, usado quando o POST é bloqueado.
- **Token no `localStorage`:** quem tiver acesso ao aparelho desbloqueado pode usar a sessão. O botão **Sair** apaga o token e os dados guardados; recomende-o em aparelhos compartilhados.
- **A logo** é entregue sem login, porque a tela de entrada a exibe. Não use uma imagem que não possa ser vista por qualquer pessoa.
- **Dependências por CDN** (Tailwind e flatpickr) sem verificação de integridade.
- Os limites de cota do Apps Script e do Sheets valem para o uso em escala.

## Boas práticas para quem for implantar

1. Restrinja o compartilhamento da planilha ao administrador.
2. Entregue o PIN a cada pessoa por um canal individual, e apague o registro de execução depois de anotar.
3. Desative (`Ativo = NAO`) quem sair, em vez de apagar a linha: o acesso cai na hora e o histórico se mantém.
4. Se suspeitar de vazamento, troque os PINs e rode `encerrarTodasAsSessoes()`.
5. Não publique `config.js`, planilhas reais, exportações nem prints com e-mails ou telefones.

## Evoluções possíveis

- Guardar apenas o **hash** do PIN (com sal) e ter um fluxo de redefinição.
- Subresource Integrity nos scripts de CDN, ou copiar as bibliotecas para o repositório.
- Registro de tentativas de login na planilha.
