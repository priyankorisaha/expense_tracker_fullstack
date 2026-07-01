require('dotenv').config()
const express = require('express')
const cors = require('cors');
const { db } = require('./db/db');
const { ensureMlService } = require('./services/ai');
const {readdirSync} = require('fs')
const app = express()




const DEFAULT_PORT = 5000;
const REQUESTED_PORT = Number(process.env.PORT) || DEFAULT_PORT;
const PORT_CANDIDATES = [...new Set([REQUESTED_PORT, DEFAULT_PORT, 5001, 5002, 5003])];

const startServerOnPort = (port) => new Promise((resolve, reject) => {
    const listener = app.listen(port, () => resolve({ listener, port }));
    listener.on('error', (err) => reject(err));
});

const choosePort = async () => {
    for (const port of PORT_CANDIDATES) {
        try {
            const { listener, port: boundPort } = await startServerOnPort(port);
            return { listener, boundPort };
        } catch (err) {
            if (err.code === 'EADDRINUSE') {
                console.warn(`Port ${port} is already in use, trying the next available port...`);
                continue;
            }
            throw err;
        }
    }
    throw new Error(`Unable to bind backend to any available ports: ${PORT_CANDIDATES.join(', ')}`);
};

//middlewares
app.use(express.json())
app.use(cors())


//routes
readdirSync('./routes').filter(file => file.endsWith('.js')).forEach((route) => app.use('/api/v1', require('./routes/' + route)))

const server = async () => {
    db()
    let listener, boundPort;
    try {
        ({ listener, boundPort } = await choosePort());
        console.log('listening to port:', boundPort);
    } catch (err) {
        console.error('Unable to start backend server:', err.message || err);
        process.exit(1);
    }

    listener.on('error', (err) => {
        console.error('Server error:', err);
    });

    ensureMlService()
        .then((ready) => console.log(`ML service ready: ${ready}`))
        .catch((err) => console.warn('ML service bootstrap error:', err));
}

server()