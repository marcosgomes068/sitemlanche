# Bot de WhatsApp para Pedidos de Espetinhos

Bot de WhatsApp para gerenciamento de pedidos de espetinhos, com dashboard para acompanhamento.

## Funcionalidades

- Recebimento de pedidos via WhatsApp
- Confirmação e cancelamento de pedidos
- Dashboard para acompanhamento
- Estatísticas em tempo real
- Cardápio digital integrado

## Requisitos

- Node.js 18 ou superior
- NPM (Node Package Manager)
- Navegador web moderno
- WhatsApp Web

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/espetinhos-bot.git
cd espetinhos-bot
```

2. Instale as dependências:
```bash
npm install
```

3. Configure o arquivo `.env`:
```env
PORT=3000
CARDAPIO_URL=https://marcosgomes068.github.io/cardapioconcept/
```

## Uso

1. Inicie o bot:
```bash
npm start
```

2. Escaneie o QR Code com seu WhatsApp

3. Acesse o dashboard em:
```
http://localhost:3000/dashboard
```

## Comandos do Bot

- `/cardapio` - Ver cardápio
- `/confirmar` - Confirmar pedido
- `/cancelar` - Cancelar pedido
- `/status` - Verificar status
- `/ajuda` - Ver ajuda

## Formato do Pedido

Para fazer um pedido, envie uma mensagem no formato:
```
*PEDIDO - ESPETINHOS*
[Seus itens aqui]
```

## Dashboard

O dashboard permite:
- Visualizar pedidos ativos
- Atualizar status dos pedidos
- Ver estatísticas em tempo real
- Gerenciar entregas

## Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## Contato

- WhatsApp: +55 68 9208-8865
- Email: seu-email@exemplo.com 