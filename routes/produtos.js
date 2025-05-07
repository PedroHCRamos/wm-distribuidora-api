const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Rota: criar-produto (Pasta: Produtos)
router.post('/produtos', 
    authenticateToken,
    [
        body('nome')
            .isString()
            .notEmpty()
            .withMessage('O nome do produto é obrigatório e deve ser uma string'),
        body('preco_base')
            .isFloat({ min: 0.01 })
            .withMessage('O preço base deve ser um número positivo maior que 0'),
        body('marca')
            .isString()
            .notEmpty()
            .withMessage('A marca do produto é obrigatória e deve ser uma string'),
        body('peso_unitario')
            .isFloat({ min: 0.01 })
            .withMessage('O peso unitário deve ser um número positivo maior que 0')
    ],
    async (req, res) => {
        // Verificar se o usuário é admin
        if (req.user.role !== 'admin') {
            console.log('Acesso negado: usuário não é admin:', req.user);
            return res.status(403).json({ error: 'Acesso negado: apenas administradores podem criar produtos' });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Erros de validação:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { nome, preco_base, marca, peso_unitario } = req.body;
        console.log('Criando produto com:', { nome, preco_base, marca, peso_unitario });

        try {
            const result = await pool.query(
                'INSERT INTO produtos (nome, preco_base, marca, peso_unitario) VALUES ($1, $2, $3, $4) RETURNING *',
                [nome, preco_base, marca, peso_unitario]
            );
            const produto = result.rows[0];
            console.log('Produto criado:', produto);
            res.status(201).json(produto);
        } catch (error) {
            console.error('Erro ao criar produto:', error.stack);
            res.status(500).json({ error: 'Erro no servidor' });
        }
    }
);

// Rota: listar-produtos (Pasta: Produtos)
router.get('/produtos', authenticateToken, async (req, res) => {
    // Verificar se o usuário é admin
    if (req.user.role !== 'admin') {
        console.log('Acesso negado: usuário não é admin:', req.user);
        return res.status(403).json({ error: 'Acesso negado: apenas administradores podem listar produtos' });
    }

    console.log('Listando produtos');

    try {
        const result = await pool.query('SELECT * FROM produtos ORDER BY id ASC');
        const produtos = result.rows;
        console.log('Produtos encontrados:', produtos);
        res.json(produtos);
    } catch (error) {
        console.error('Erro ao listar produtos:', error.stack);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Rota: editar-produto (Pasta: Produtos)
router.put('/produtos/:id', 
    authenticateToken,
    [
        body('nome')
            .optional()
            .isString()
            .notEmpty()
            .withMessage('O nome do produto, se fornecido, deve ser uma string não vazia'),
        body('preco_base')
            .optional()
            .isFloat({ min: 0.01 })
            .withMessage('O preço base, se fornecido, deve ser um número positivo maior que 0'),
        body('marca')
            .optional()
            .isString()
            .notEmpty()
            .withMessage('A marca do produto, se fornecida, deve ser uma string não vazia'),
        body('peso_unitario')
            .optional()
            .isFloat({ min: 0.01 })
            .withMessage('O peso unitário, se fornecido, deve ser um número positivo maior que 0')
    ],
    async (req, res) => {
        // Verificar se o usuário é admin
        if (req.user.role !== 'admin') {
            console.log('Acesso negado: usuário não é admin:', req.user);
            return res.status(403).json({ error: 'Acesso negado: apenas administradores podem editar produtos' });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Erros de validação:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { id } = req.params;
        const { nome, preco_base, marca, peso_unitario } = req.body;
        console.log('Editando produto:', { id, nome, preco_base, marca, peso_unitario });

        try {
            const produtoResult = await pool.query('SELECT * FROM produtos WHERE id = $1', [id]);
            if (produtoResult.rowCount === 0) {
                console.log('Produto não encontrado:', id);
                return res.status(404).json({ error: 'Produto não encontrado' });
            }

            const updates = {};
            if (nome) updates.nome = nome;
            if (preco_base) updates.preco_base = preco_base;
            if (marca) updates.marca = marca;
            if (peso_unitario) updates.peso_unitario = peso_unitario;

            if (Object.keys(updates).length === 0) {
                console.log('Nenhum dado fornecido para atualização');
                return res.status(400).json({ error: 'Nenhum dado fornecido para atualização' });
            }

            const result = await pool.query(
                'UPDATE produtos SET nome = COALESCE($1, nome), preco_base = COALESCE($2, preco_base), marca = COALESCE($3, marca), peso_unitario = COALESCE($4, peso_unitario) WHERE id = $5 RETURNING *',
                [nome, preco_base, marca, peso_unitario, id]
            );
            const produto = result.rows[0];
            console.log('Produto atualizado:', produto);
            res.json(produto);
        } catch (error) {
            console.error('Erro ao editar produto:', error.stack);
            res.status(500).json({ error: 'Erro no servidor' });
        }
    }
);

// Rota: deletar-produto (Pasta: Produtos)
router.delete('/produtos/:id', authenticateToken, async (req, res) => {
    // Verificar se o usuário é admin
    if (req.user.role !== 'admin') {
        console.log('Acesso negado: usuário não é admin:', req.user);
        return res.status(403).json({ error: 'Acesso negado: apenas administradores podem deletar produtos' });
    }

    const { id } = req.params;
    console.log('Deletando produto:', id);

    try {
        const result = await pool.query('DELETE FROM produtos WHERE id = $1 RETURNING *', [id]);
        if (result.rowCount === 0) {
            console.log('Produto não encontrado:', id);
            return res.status(404).json({ error: 'Produto não encontrado' });
        }
        console.log('Produto deletado:', result.rows[0]);
        res.json({ message: 'Produto deletado com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar produto:', error.stack);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

module.exports = router;