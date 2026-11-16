# Loja de café e pelúcias (projeto escolar)
    npm install
    ADMIN_PASSWORD=suasenha npm start    # sem a variável, a senha é admin123
Site: http://localhost:3000 | Painel: http://localhost:3000/admin
Dados ficam em data/db.json e as imagens em data/uploads/.
Pela API (com senha no header x-admin-password): PUT /api/admin/site, POST/PUT/DELETE /api/admin/products
Pedidos: o site envia POST /api/orders (nome, contato, itens com id e qty; o servidor recalcula os preços) e eles ficam em data/db.json.
No painel, aba "Pedidos": mudar status (novo, pago, enviado, entregue, cancelado) ou excluir. API admin: GET /api/admin/orders, PUT/DELETE /api/admin/orders/:id
