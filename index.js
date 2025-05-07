const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRoutes = require('./routes/auth');
const faixasPrecoRoutes = require('./routes/faixas-preco');
const pedidosRoutes = require('./routes/pedidos');
const produtosRoutes = require('./routes/produtos');
const relatoriosRoutes = require('./routes/relatorios');

const app = express();

app.use(cors());
app.use(express.json());

// Rotas
app.use('/api', authRoutes);
app.use('/api/', faixasPrecoRoutes);
app.use('/api/', pedidosRoutes);
app.use('/api', produtosRoutes); 
app.use('/api/', relatoriosRoutes);

// Testar conexão com o banco
app.get('/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ message: 'Conexão com o banco OK!', time: result.rows[0].now });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao conectar ao banco' });
    }
});

app.get('/', (req, res) => {
    res.send('Servidor da WM Distribuidora funcionando!');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});