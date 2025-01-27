#!/bin/bash

# Verifica se o script está sendo executado como root
if [ "$EUID" -ne 0 ]; then
  echo "Por favor, execute como root ou use sudo!"
  exit
fi

# Mensagem inicial
echo "INICIANDO SCRIPT"

# Instala as dependências do projeto
echo "Instalando dependências necessárias..."
npm install express
npm install pm2 -g

# Mensagem para indicar que as dependências foram instaladas
echo "Dependências instaladas com sucesso."

# Inicia o arquivo 'Unknown.js' com PM2
if [ -f "Unknown.js" ]; then
  echo "Iniciando o arquivo Unknown.js com PM2..."
  pm2 start Unknown.js --name "meu-app"
  echo "Aplicação gerenciada pelo PM2!"
else
  echo "Erro: Arquivo 'Unknown.js' não encontrado!"
fi

# Lista os processos do PM2
pm2 list
