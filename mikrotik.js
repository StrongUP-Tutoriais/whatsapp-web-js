const MikroNode = require('mikronode');

// Configuração do MikroTik
const device = new MikroNode('45.181.8.42'); // Substitua pelo IP correto

(async () => {
    try {
        // Estabelecer a conexão com o MikroTik
        const connection = await device.connect('user1', '3233233'); // Substitua pelas credenciais corretas

        console.log('Conexão bem-sucedida ao MikroTik!');

        // Comando para listar as conexões PPPoE ativas
        const result = await connection.('/ppp/active/print');

        console.log('Conexões PPPoE ativas:');
        console.log(result); // Exibe os dados retornados

        // Fechar a conexão
        connection.close();
        console.log('Conexão encerrada com sucesso.');

    } catch (error) {
        console.error('Erro inesperado:', error.message);
    }
})();
