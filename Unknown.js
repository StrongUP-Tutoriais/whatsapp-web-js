const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
const { Client, Location, Poll, List, Buttons, LocalAuth } = require('./index');
const qrcodeterm = require("qrcode-terminal");
const { format } = require('date-fns');
const winston = require('winston');
const path = require('path');
const fs = require('fs');


const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Adiciona a data e hora no formato desejado
        winston.format.printf(({ timestamp, message }) => {
            return `{"${timestamp}","message":"${message}"}`; // Formata a saída conforme desejado
        })
    ),
    transports: [
        new winston.transports.Console(), // Log no console
        new winston.transports.File({ filename: 'SYSLOG.log' }) // Log em arquivo
    ]
});


// Configurações de horário comercial
const businessHours = {
    start: 8,  // 08:00
    end: 19    // 19:00
};

// Função para verificar se estamos dentro do horário comercial
function isWithinBusinessHours() {
    const now = new Date();
    const currentHour = now.getHours();
    return currentHour >= businessHours.start && currentHour < businessHours.end;
}

const app = express();

// Configurando o body-parser para aceitar payloads maiores
app.use(bodyParser.json({ limit: '10mb' })); // Reduza o limite se não for necessário mais
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Inicializando o cliente do WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "User01", dataPath: "./Sessoes" }),
    // proxyAuthentication: { username: 'username', password: 'password' },
    puppeteer: {
        // executablePath: '/usr/bin/google-chrome',
        // args: ['--proxy-server=proxy-server-that-requires-authentication.example.com'],
        headless: true,
    }
});



client.on('disconnected', (reason) => {
    logger.error('Cliente desconectado:', reason);
    client.destroy();
    client.initialize();
});


// Evento de carregamento do cliente
client.on('loading_screen', (percent, message) => {
    logger.warn(`LOADING SCREEN: ${percent}% - ${message}`);
});

// Geração do QR code
client.on("qr", (qr) => {
    qrcodeterm.generate(qr, { small: true }, function (qrcode) {
        logger.warn('QR code gerado com sucesso');
        console.log(qrcode);  // Mostrando o QR code no console

        // Logando o QR code no arquivo de logs
        logger.warn('QR Code gerado: \n' + qrcode); // Adicionando o conteúdo do QR Code no log
    });
});


client.on('auth_failure', msg => {
    // Fired if session restore was unsuccessful
    console.error('AUTHENTICATION FAILURE', msg);
});

let clientStatus = 'disconnected'; // Inicialmente, o cliente está desconectado

client.on('ready', async () => {
    console.log('READY');
    clientStatus = 'ready'; // Inicialmente, o cliente está desconectado
    const debugWWebVersion = await client.getWWebVersion();
    console.log(`WWebVersion = ${debugWWebVersion}`);

    client.pupPage.on('pageerror', function (err) {
        console.log('Page error: ' + err.toString());
    });
    client.pupPage.on('error', function (err) {
        console.log('Page error: ' + err.toString());
    });

});

// Inicializando o cliente
client.initialize().catch((err) => {
    logger.error('Erro ao inicializar o cliente do WhatsApp:', err.message);
});

// Controle de chamadas fora do horário comercial
if (!isWithinBusinessHours()) {
    let rejectCalls = true;
    client.on('call', async (call) => {
        if (!isWithinBusinessHours()) {
            try {
                await call.reject();
                await client.sendMessage(call.from, 'Fora do horário comercial.');
                logger.warn(`Chamada rejeitada de: ${call.from}`);
            } catch (error) {
                logger.error('Erro ao rejeitar chamada:', error.message);
            }
        }
    });

}

// Evento de recebimento de mensagens
client.on('message', async msg => {

    const chatId = msg.from;
    const messageBody = msg.body.trim().toLowerCase();

    // Exemplo de resposta com delay
    if (msg.body === "jaco" || msg.body.toLowerCase() === "jaco") {
        setTimeout(() => {
            msg.reply("Oi");
            logger.warn(`Mensagem "Oi" enviada em resposta a "jaco" para ${chatId}`);
        }, 30000);  // Delay de 30 segundos
    }

    // Regex para detectar mensagens relacionadas a Pix
    const regex = /.*pix.*/i;
    if (regex.test(msg.body)) {
        logger.warn(`Cliente pediu a chave pix: ${msg.body}`);
        const respostasPix = [
            "Chave Pix Telefone: 85985304415 - Nome: Jaco Leone Amorim Melo - Inst: Caixa Economica Federal"
        ];

        // Função para escolher uma resposta Pix aleatoriamente
        setTimeout(() => {
            const randomResponse = respostasPix[Math.floor(Math.random() * respostasPix.length)];
            msg.reply(randomResponse);
            logger.warn(`Resposta Pix enviada para ${chatId}`);
        }, 10000);


    }
});


const cache = {}; // Armazenamento em cache para reduzir chamadas repetitivas
function memoize(func) {
    return function (...args) {
        const key = JSON.stringify(args);
        if (cache[key]) return cache[key];
        const result = func(...args);
        cache[key] = result;
        return result;
    };
}

setInterval(() => {
    // Exemplo de otimização simples: Cache para chamadas repetitivas
    const now = new Date().getSeconds();
    const expensiveFunction = memoize((x) => x * 100); // Exemplo de função cara
    // console.log(`Resultado: ${expensiveFunction(now)}`);
}, 2000);


setInterval(() => {
    const memory = process.memoryUsage().heapUsed / 1024 / 1024;
    const cpu = require('os').loadavg()[0];
    // console.log(`Memória: ${memory.toFixed(2)} MB | CPU: ${cpu.toFixed(2)}`);

    if (memory > 100) {
        console.log("Memória alta, liberando...");
        global.gc && global.gc();  // Exige execução com o parâmetro --expose-gc
    }
    if (cpu > 2.0) {
        console.log("CPU alta, desacelerando...");
        setTimeout(() => { }, 1000); // Pausa o loop por 1 segundo
    }
}, 2000);



app.get('/logs', (req, res) => {
    const logFilePath = path.join(__dirname, 'SYSLOG.log'); // Caminho do arquivo de log

    fs.readFile(logFilePath, 'utf8', (err, data) => {
        if (err) {
            console.error("Erro ao ler o arquivo de log:", err);
            return res.status(500).send('Erro ao ler o arquivo de log.');
        }

        // Verifica o status do cliente
        const clientStatusColor = clientStatus === 'ready' ? 'green' : 'red';

        // Cria um HTML básico para exibir o conteúdo do log com a bolinha
        const htmlContent = `
            <html>
                <head>
                    <title>Logs do Sistema</title>
                    <style>
                        body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
                        pre { background-color: #333; color: #fff; padding: 20px; font-size: 14px; }
                        .status-bullet { width: 15px; height: 15px; border-radius: 50%; display: inline-block; }
                        .green { background-color: green; }
                        .red { background-color: red; }
                    </style>
                </head>
                <body>
                    <h1>Logs do Sistema</h1>
                    <div><span class="status-bullet ${clientStatusColor}"></span> Status do Cliente: ${clientStatus === 'ready' ? 'Ativo' : 'Desconectado'}</div>
                    <pre>${data}</pre>
                </body>
            </html>
        `;

        res.send(htmlContent);
    });
});

// Função genérica para capturar todas as requisições e exibir os dados
//app.use((req, res, next) => {
//    logger.warn("Recebeu uma requisição genérica:");
//    logger.warn(`Método: ${req.method}`);
//    logger.warn(`URL: ${req.url}`);
//    logger.warn(`Query params: ${JSON.stringify(req.query)}`);
//    logger.warn(`Corpo da requisição: ${JSON.stringify(req.body)}`);
//    next();
//});

// Função para formatar número de telefone
function phoneNumberFormatter(number) {
    if (!number) return '';
    const isWid = number.includes('@c.us') ? true : false;
    if (isWid) {
        return number.replace('@c.us', '').replace(/[^0-9]/g, '');
    }
    return number.replace(/[^0-9]/g, '');
}

// Endpoint para envio de mensagens
app.post('/send-message', [
    body('to').isString().notEmpty().withMessage('Número do destinatário é obrigatório'),
    body('msg').isString().notEmpty().withMessage('Mensagem é obrigatória'),
    body('login').isString().notEmpty().withMessage('Login é obrigatório'),
    body('pass').isString().notEmpty().withMessage('Senha é obrigatória')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { to, msg, login, pass } = req.body;

    // Sanitização dos inputs para evitar injeções de código
    const sanitizedMsg = msg.replace(/<[^>]*>?/gm, '');  // Remove tags HTML
    const sanitizedLogin = login.replace(/[^a-zA-Z0-9]/g, '');  // Remove caracteres especiais

    try {
        const formattedNumber = phoneNumberFormatter(to);

        if (!formattedNumber) {
            logger.warn(`Tentativa de enviar mensagem para número inválido: ${to}`);
            return res.status(400).json({ error: 'Número de telefone inválido' });
        }

        const contactId = `${formattedNumber}@c.us`; // Formata o número corretamente para o WhatsApp

        // Verifica se o número está registrado no WhatsApp
        const isRegistered = await client.isRegisteredUser(contactId);

        if (!isRegistered) {
            logger.warn(`número não registrado no WhatsApp: ${formattedNumber}`);
            logger.info(`número não registrado no WhatsApp: ${formattedNumber},'Mensagem:',${msg}`);
            return res.status(400).json({ error: 'Número não registrado no WhatsApp' });
        }

        // Envia a mensagem caso o número seja válido e registrado
        await client.sendMessage(contactId, sanitizedMsg);
        logger.info(`Mensagem enviada com sucesso para: ${formattedNumber},'Mensagem:',${msg}`);
        res.status(200).send('Mensagem enviada com sucesso!');
    } catch (error) {
        logger.error(`Erro ao enviar mensagem: ${error.message || error}`);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }


});

// Middleware para capturar erros
//app.use((err, req, res, next) => {
//    logger.error('Erro capturado pelo middleware:', err.stack);
//    res.status(500).json({ error: 'Erro interno no servidor' });
//});

// Inicializando o servidor
app.listen(8000, () => {
    logger.warn('Servidor rodando na porta 8000');
});
