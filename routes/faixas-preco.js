const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Criar faixa de preço
router.post('/faixas-preco', 
    authenticateToken,
    [
        body('produto_id')
            .isInt({ min: 1 })
            .withMessage('O produto_id deve ser um número inteiro positivo'),
        body('quantidade_minima')
            .isInt({ min: 1 })
            .withMessage('A quantidade mínima deve ser um número inteiro positivo'),
        body('preco')
            .isFloat({ min: 0.01 })
            .withMessage('O preço deve ser um número positivo maior que 0')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Erros de validação:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { produto_id, quantidade_minima, preco } = req.body;
        console.log('Criando faixa de preço com:', { produto_id, quantidade_minima, preco });

        try {
            const produtoResult = await pool.query('SELECT * FROM produtos WHERE id = $1', [produto_id]);
            if (produtoResult.rowCount === 0) {
                console.log('Produto não encontrado:', produto_id);
                return res.status(404).json({ error: 'Produto não encontrado' });
            }

            const result = await pool.query(
                'INSERT INTO faixas_preco (produto_id, quantidade_minima, preco) VALUES ($1, $2, $3) RETURNING *',
                [produto_id, quantidade_minima, preco]
            );
            const faixa = result.rows[0];
            console.log('Faixa de preço criada:', faixa);
            res.status(201).json(faixa);
        } catch (error) {
            console.error('Erro ao criar faixa de preço:', error.stack);
            res.status(500).json({ error: 'Erro no servidor' });
        }
    }
);

module.exports = router;