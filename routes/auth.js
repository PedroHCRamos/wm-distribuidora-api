const express = require('express');
const pool = require('../db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// Rota: autenticar-admin (Pasta: Autenticação)
router.post('/admin/login', async (req, res) => {
    const { usuario, senha } = req.body;
    console.log('Autenticando admin com:', { usuario });

    try {
        const result = await pool.query('SELECT * FROM administradores WHERE usuario = $1', [usuario]);
        if (result.rowCount === 0) {
            console.log('Admin não encontrado:', usuario);
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const admin = result.rows[0];
        if (admin.senha !== senha) {
            console.log('Senha incorreta para admin:', usuario);
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const token = jwt.sign({ id: admin.id, role: 'admin' }, process.env.JWT_SECRET || 'seu_segredo', { expiresIn: '1h' });
        console.log('Token gerado para admin:', usuario);
        res.json({ token, admin: { id: admin.id, usuario: admin.usuario } });
    } catch (error) {
        console.error('Erro ao autenticar admin:', error.stack);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Rota: autenticar-lojista (Pasta: Autenticação)
router.post('/lojistas/login', async (req, res) => {
    const { email, senha } = req.body;
    console.log('Autenticando lojista com:', { email });

    try {
        const result = await pool.query('SELECT * FROM lojistas WHERE email = $1', [email]);
        if (result.rowCount === 0) {
            console.log('Lojista não encontrado:', email);
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const lojista = result.rows[0];
        const match = await bcrypt.compare(senha, lojista.senha);
        if (!match) {
            console.log('Senha incorreta para lojista:', email);
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const token = jwt.sign({ id: lojista.id, role: 'lojista' }, process.env.JWT_SECRET || 'seu_segredo', { expiresIn: '1h' });
        console.log('Token gerado para lojista:', email);
        res.json({ token, lojista: { id: lojista.id, email: lojista.email } });
    } catch (error) {
        console.error('Erro ao autenticar lojista:', error.stack);
        res.status(500).json({ error: 'Erro no servidor' });
    }
});

// Rota: criar-lojista (Pasta: Autenticação)
router.post('/lojistas', 
    authenticateToken,
    [
        body('email')
            .isEmail()
            .withMessage('O email deve ser válido'),
        body('senha')
            .isLength({ min: 6 })
            .withMessage('A senha deve ter pelo menos 6 caracteres'),
        body('nome')
            .isString()
            .notEmpty()
            .withMessage('O nome do lojista é obrigatório'),
        body('cnpj')
            .isString()
            .notEmpty()
            .matches(/^\d{14}$/)
            .withMessage('O CNPJ deve ter exatamente 14 dígitos numéricos'),
        body('endereco')
            .isString()
            .notEmpty()
            .withMessage('O endereço do lojista é obrigatório')
    ],
    async (req, res) => {
        // Verificar se o usuário é admin
        if (req.user.role !== 'admin') {
            console.log('Acesso negado: usuário não é admin:', req.user);
            return res.status(403).json({ error: 'Acesso negado: apenas administradores podem criar lojistas' });
        }

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Erros de validação:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, senha, nome, cnpj, endereco } = req.body;
        console.log('Criando lojista com:', { email, nome, cnpj, endereco });

        try {
            // Verificar se o email já está em uso
            const emailCheck = await pool.query('SELECT * FROM lojistas WHERE email = $1', [email]);
            if (emailCheck.rowCount > 0) {
                console.log('Email já em uso:', email);
                return res.status(400).json({ error: 'Email já em uso' });
            }

            // Verificar se o CNPJ já está em uso
            const cnpjCheck = await pool.query('SELECT * FROM lojistas WHERE cnpj = $1', [cnpj]);
            if (cnpjCheck.rowCount > 0) {
                console.log('CNPJ já em uso:', cnpj);
                return res.status(400).json({ error: 'CNPJ já em uso' });
            }

            // Criptografar a senha
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(senha, saltRounds);

            // Inserir o novo lojista
            const result = await pool.query(
                'INSERT INTO lojistas (email, senha, nome, cnpj, endereco) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [email, hashedPassword, nome, cnpj, endereco]
            );
            const lojista = result.rows[0];
            console.log('Lojista criado:', lojista);
            res.status(201).json({ id: lojista.id, email: lojista.email, nome: lojista.nome, cnpj: lojista.cnpj, endereco: lojista.endereco });
        } catch (error) {
            console.error('Erro ao criar lojista:', error.stack);
            res.status(500).json({ error: 'Erro no servidor' });
        }
    }
);

module.exports = router;