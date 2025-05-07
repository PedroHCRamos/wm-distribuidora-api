const bcrypt = require('bcrypt');

const senha = 'admin123';
bcrypt.hash(senha, 10, (err, hash) => {
    if (err) {
        console.error('Erro:', err);
    } else {
        console.log('Hash gerado:', hash);
    }
});