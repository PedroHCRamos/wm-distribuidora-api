const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Rota: criar-pedido (Pasta: Pedidos)
router.post('/pedidos', 
    authenticateToken,
    [
        body('produto_id')
            .isInt({ min: 1 })
            .withMessage('O produto_id deve ser um número inteiro positivo'),
        body('quantidade')
            .isInt({ min: 1 })
            .withMessage('A quantidade deve ser um número inteiro positivo')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Erros de validação:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { produto_id, quantidade } = req.body;
        const lojista_id = req.user.id;
        console.log('Criando pedido com:', { produto_id, quantidade, lojista_id });

        try {
            const produtoResult = await pool.query('SELECT * FROM produtos WHERE id = $1', [produto_id]);
            if (produtoResult.rowCount === 0) {
                console.log('Produto não encontrado:', produto_id);
                return res.status(404).json({ error: 'Produto não encontrado' });
            }
            const produto = produtoResult.rows[0];

            const faixaResult = await pool.query(
                'SELECT preco FROM faixas_preco WHERE produto_id = $1 AND quantidade_minima <= $2 ORDER BY quantidade_minima DESC LIMIT 1',
                [produto_id, quantidade]
            );
            let preco_unitario = faixaResult.rowCount > 0 ? faixaResult.rows[0].preco : produto.preco_base;
            console.log(faixaResult.rowCount > 0 ? 'Faixa de preço encontrada:' : 'Usando preço base:', { preco: preco_unitario });

            const preco_total = preco_unitario * quantidade;
            const result = await pool.query(
                'INSERT INTO pedidos (lojista_id, produto_id, quantidade, preco_unitario, preco_total) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [lojista_id, produto_id, quantidade, preco_unitario, preco_total]
            );
            const pedido = result.rows[0];
            console.log('Pedido criado:', pedido);
            res.status(201).json(pedido);
        } catch (error) {
            console.error('Erro ao criar pedido:', error.stack);
            res.status(500).json({ error: 'Erro no servidor' });
        }
    }
);

// Rota: listar-pedidos (Pasta: Pedidos)
router.get('/pedidos', authenticateToken, async (req, res) => {
    // Restringir a administradores
    if (req.user.role !== 'admin') {
        console.log('Acesso negado: usuário não é admin:', req.user);
        return res.status(403).json({ error: 'Acesso negado: apenas administradores podem listar todos os pedidos' });
    }

    const { lojista_id, page = 1, limit = 10 } = req.query;
    console.log('Listando pedidos com:', { lojista_id, page, limit });

    try {
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;

        if (pageNum < 1 || limitNum < 1) {
            console.log('Parâmetros de paginação inválidos:', { page, limit });
            return res.status(400).json({ error: 'Página e limite devem ser números positivos' });
        }

        let query = 'SELECT * FROM pedidos';
        let countQuery = 'SELECT COUNT(*) FROM pedidos';
        const queryParams = [];
        const countParams = [];

        if (lojista_id) {
            query += ' WHERE lojista_id = $1';
            countQuery += ' WHERE lojista_id = $1';
            queryParams.push(lojista_id);
            countParams.push(lojista_id);
        }

        query += ` ORDER BY id DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
        queryParams.push(limitNum, offset);

        const countResult = await pool.query(countQuery, countParams);
        const totalItems = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalItems / limitNum);

        const result = await pool.query(query, queryParams);
        const pedidos = result.rows;

        console.log('Pedidos encontrados:', pedidos);
        res.json({
            pedidos,
            meta: {
                page: pageNum,
                limit: limitNum,
                totalItems,
                totalPages
            }
        });
    } catch (error) {
        console.error('Erro ao listar pedidos:', error.stack);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Nova Rota: listar-meus-pedidos (Pasta: Pedidos)
router.get('/pedidos/me', authenticateToken, async (req, res) => {
    // Permitir apenas a lojistas
    if (req.user.role !== 'lojista') {
        console.log('Acesso negado: usuário não é lojista:', req.user);
        return res.status(403).json({ error: 'Acesso negado: apenas lojistas podem listar seus próprios pedidos' });
    }

    const lojista_id = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    console.log('Listando pedidos do lojista:', { lojista_id, page, limit });

    try {
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;

        if (pageNum < 1 || limitNum < 1) {
            console.log('Parâmetros de paginação inválidos:', { page, limit });
            return res.status(400).json({ error: 'Página e limite devem ser números positivos' });
        }

        const query = 'SELECT * FROM pedidos WHERE lojista_id = $1 ORDER BY id DESC LIMIT $2 OFFSET $3';
        const countQuery = 'SELECT COUNT(*) FROM pedidos WHERE lojista_id = $1';
        const queryParams = [lojista_id, limitNum, offset];
        const countParams = [lojista_id];

        const countResult = await pool.query(countQuery, countParams);
        const totalItems = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalItems / limitNum);

        const result = await pool.query(query, queryParams);
        const pedidos = result.rows;

        console.log('Pedidos encontrados:', pedidos);
        res.json({
            pedidos,
            meta: {
                page: pageNum,
                limit: limitNum,
                totalItems,
                totalPages
            }
        });
    } catch (error) {
        console.error('Erro ao listar pedidos do lojista:', error.stack);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Rota: atualizar-pedido (Pasta: Pedidos)
router.put('/pedidos/:id', authenticateToken, async (req, res) => {
    // Permitir apenas a lojistas
    if (req.user.role !== 'lojista') {
        console.log('Acesso negado: usuário não é lojista:', req.user);
        return res.status(403).json({ error: 'Acesso negado: apenas lojistas podem atualizar pedidos' });
    }

    const { id } = req.params;
    const { produto_id, quantidade } = req.body;
    const lojista_id = req.user.id;
    console.log('Atualizando pedido:', { id, produto_id, quantidade, lojista_id });

    try {
        // Verificar se o pedido pertence ao lojista
        const pedidoResult = await pool.query('SELECT * FROM pedidos WHERE id = $1 AND lojista_id = $2', [id, lojista_id]);
        if (pedidoResult.rowCount === 0) {
            console.log('Pedido não encontrado ou não pertence ao lojista:', { id, lojista_id });
            return res.status(404).json({ error: 'Pedido não encontrado ou não pertence a este lojista' });
        }

        const produtoResult = await pool.query('SELECT * FROM produtos WHERE id = $1', [produto_id]);
        if (produtoResult.rowCount === 0) {
            console.log('Produto não encontrado:', produto_id);
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        const produto = produtoResult.rows[0];

        const faixaResult = await pool.query(
            'SELECT preco FROM faixas_preco WHERE produto_id = $1 AND quantidade_minima <= $2 ORDER BY quantidade_minima DESC LIMIT 1',
            [produto_id, quantidade]
        );
        let preco_unitario = faixaResult.rowCount > 0 ? faixaResult.rows[0].preco : produto.preco_base;
        const preco_total = preco_unitario * quantidade;

        const result = await pool.query(
            'UPDATE pedidos SET produto_id = $1, quantidade = $2, preco_unitario = $3, preco_total = $4 WHERE id = $5 RETURNING *',
            [produto_id, quantidade, preco_unitario, preco_total, id]
        );
        console.log('Pedido atualizado:', result.rows[0]);
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar pedido:', error.stack);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Rota: excluir-pedido (Pasta: Pedidos)
router.delete('/pedidos/:id', authenticateToken, async (req, res) => {
    // Permitir apenas a lojistas
    if (req.user.role !== 'lojista') {
        console.log('Acesso negado: usuário não é lojista:', req.user);
        return res.status(403).json({ error: 'Acesso negado: apenas lojistas podem excluir pedidos' });
    }

    const { id } = req.params;
    const lojista_id = req.user.id;
    console.log('Excluindo pedido:', { id, lojista_id });

    try {
        // Verificar se o pedido pertence ao lojista
        const pedidoResult = await pool.query('SELECT * FROM pedidos WHERE id = $1 AND lojista_id = $2', [id, lojista_id]);
        if (pedidoResult.rowCount === 0) {
            console.log('Pedido não encontrado ou não pertence ao lojista:', { id, lojista_id });
            return res.status(404).json({ error: 'Pedido não encontrado ou não pertence a este lojista' });
        }

        const result = await pool.query('DELETE FROM pedidos WHERE id = $1 RETURNING *', [id]);
        console.log('Pedido excluído:', result.rows[0]);
        res.json({ message: 'Pedido excluído com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir pedido:', error.stack);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

module.exports = router;