const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

router.get('/relatorios/pedidos-por-lojista', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        console.log('Acesso negado: usuário não é admin:', req.user);
        return res.status(403).json({ error: 'Acesso negado: apenas administradores podem gerar relatórios' });
    }

    const { page = 1, limit = 10 } = req.query;
    console.log('Gerando relatório de pedidos por lojista com:', { page, limit });

    try {
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;

        if (pageNum < 1 || limitNum < 1) {
            console.log('Parâmetros de paginação inválidos:', { page, limit });
            return res.status(400).json({ error: 'Página e limite devem ser números positivos' });
        }

        const query = `
            SELECT 
                lojista_id,
                COUNT(*) as total_pedidos,
                SUM(preco_total) as valor_total
            FROM pedidos
            GROUP BY lojista_id
            ORDER BY lojista_id ASC
            LIMIT $1 OFFSET $2
        `;
        const countQuery = 'SELECT COUNT(DISTINCT lojista_id) FROM pedidos';
        const queryParams = [limitNum, offset];

        const result = await pool.query(query, queryParams);
        const relatorio = result.rows;

        const countResult = await pool.query(countQuery);
        const totalItems = parseInt(countResult.rows[0].count, 10);
        const totalPages = Math.ceil(totalItems / limitNum);

        console.log('Relatório gerado:', relatorio);
        res.json({
            relatorio,
            meta: {
                page: pageNum,
                limit: limitNum,
                totalItems,
                totalPages
            }
        });
    } catch (error) {
        console.error('Erro ao gerar relatório:', error.stack);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

module.exports = router;