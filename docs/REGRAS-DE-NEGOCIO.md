# Regras de negócio

Todas as regras são aplicadas **no servidor**. A interface também as valida, só para dar resposta rápida.

## Datas

| Regra | Detalhe |
|---|---|
| Não reservar hoje nem o passado | A primeira data possível é amanhã |
| Reserva feita no sábado | Só vale de segunda-feira em diante (o domingo seguinte fica fechado) |
| Período aceito | `PERIODO_INICIO` a `PERIODO_FIM` no `CONFIG` (padrão: 2 anos) |
| Fuso horário | O do projeto do Apps Script (`appsscript.json`) |

## Turnos e conflitos

- Cada espaço pode ter **uma reserva por turno** em cada data.
- O turno **"Dia inteiro"** (nome configurável em `TURNO_DIA_INTEIRO`):
  - só pode ser reservado se o espaço estiver livre em **todos** os turnos da data;
  - depois de reservado, o espaço fica ocupado em todos os turnos daquela data.
- Os tipos de conflito devolvidos são `MESMO_TURNO`, `DIA_INTEIRO` e `TEM_RESERVA_NO_DIA`, cada um com uma mensagem própria.

## Bloqueios (aba `Bloqueios`)

Só **Data** e **Motivo** são obrigatórios.

| Coluna | Efeito |
|---|---|
| `Turno` vazio ou "Dia inteiro" | Bloqueia o dia todo, para todos os espaços |
| `Turno` preenchido (ex.: `Noite` ou `Tarde, Noite`) | Bloqueia só esses turnos; os outros continuam livres |
| `Ate_Data` | Repete o bloqueio de `Data` até essa data |
| `Dias_Semana` (ex.: `Quinta` ou `Terça, Quinta`) | Junto com `Ate_Data`, aplica só a esses dias da semana |
| `Observacao` | Texto livre mostrado no painel do dia |

Exemplo: todas as quintas de outubro à noite.

| Data | Motivo | Observacao | Turno | Ate_Data | Dias_Semana |
|---|---|---|---|---|---|
| 01/10/2027 | Evento interno | | Noite | 31/10/2027 | Quinta |

Se existir bloqueio de turno em uma data, o turno "Dia inteiro" também fica indisponível nela.

## Alterar e cancelar

- Só até o **dia anterior** à data da reserva.
- Só quem fez a reserva (pelo e-mail) pode alterar ou cancelar.
- **Alterar:** turno, espaço, motivo e, no espaço externo, mesas e cadeiras. A **data não muda**; para trocar de dia, cancele e reserve de novo.
- Antes de qualquer mudança, uma cópia da reserva original é gravada em `Alteracao_Cancelamento` com tipo, horário, e-mail de quem operou e o que mudou.
- Se nada foi modificado, a alteração é recusada (`SEM_MUDANCA`).

## Mesas e cadeiras

- A pergunta aparece só no espaço configurado em `ESPACO_EXTERNO`.
- Limites em `MESAS_MAX` e `CADEIRAS_MAX`. É preciso responder Sim ou Não; respondendo Sim, informe ao menos mesas ou cadeiras.

## Campos do formulário

| Campo | Regra |
|---|---|
| Pastoral / Movimento | Da lista, ou "Outra" com nome digitado (mínimo 2 caracteres) |
| Nome | Mínimo 3 caracteres |
| WhatsApp | 10 ou 11 dígitos, com DDD |
| Motivo | Entre `MOTIVO_MIN` e `MOTIVO_MAX` caracteres (padrão: 7 a 50) |

Pastoral, nome e WhatsApp vêm pré-preenchidos a partir da aba `Autorizados` e podem ser editados.

## Privacidade no calendário

O painel lateral do dia mostra espaço, turno, grupo e itens. **Nome e telefone de quem reservou nunca saem do servidor** nessa consulta. Só a própria pessoa vê a marca "Sua reserva".
