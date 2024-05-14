const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const pool = new Pool({
    host: 'dpg-cnu9h5a0si5c73ds58mg-a.oregon-postgres.render.com',
    user: 'keddour',
    password: 'ajHdWafoMvmbFB8erfBgqkdjafOUxdzU',
    database: 'achraf_16qa',
    port: 5432,
    ssl: {
        rejectUnauthorized: false
    }
});

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
    secret: 'a3d9e7549f6f0c0f8f8e82b83a8f5b9d8f4f8c5e2d9f4c8e2a8b9e2f4d5b8f2a', // Replace with your generated secret
    resave: false,
    saveUninitialized: false
}));

// User registration
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query('INSERT INTO users1 (username, password) VALUES ($1, $2) RETURNING id', [username, hashedPassword]);
        req.session.userId = result.rows[0].id;
        req.session.username = username;
        res.redirect('/');
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).send('User registration failed');
    }
});

// User login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users1 WHERE username = $1', [username]);
        const user = result.rows[0];
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user.id;
            req.session.username = username;
            res.redirect('/');
        } else {
            res.status(401).send('Invalid credentials');
        }
    } catch (error) {
        console.error('Error logging in user:', error);
        res.status(500).send('User login failed');
    }
});

// Check if user is authenticated
app.get('/auth-check', (req, res) => {
    if (req.session.userId) {
        res.json({ authenticated: true, username: req.session.username });
    } else {
        res.json({ authenticated: false });
    }
});

// Get message history
app.get('/messages', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send('Unauthorized');
    }
    const { userId } = req.session;
    try {
        const result = await pool.query(`
            SELECT * FROM messages1 
            WHERE sender = $1 OR receiver = $1
            ORDER BY timestamp ASC
        `, [req.session.username]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error retrieving messages:', error);
        res.status(500).send('Failed to retrieve messages');
    }
});

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('setUsername', async (username) => {
        const result = await pool.query('SELECT * FROM users1 WHERE username = $1', [username]);
        const user = result.rows[0];
        if (user) {
            socket.username = username;
            io.emit('userJoined', username);
        } else {
            socket.emit('userExists', `${username} does not exist.`);
        }
    });

    socket.on('private message', async ({ recipient, message }) => {
        const recipientSocketId = Object.keys(io.sockets.sockets).find(key => io.sockets.sockets[key].username === recipient);
        if (recipientSocketId) {
            io.to(recipientSocketId).emit('open conversation', socket.username);
            io.to(recipientSocketId).emit('private message', { sender: socket.username, message });

            try {
                await pool.query('INSERT INTO messages1 (sender, receiver, message) VALUES ($1, $2, $3)', [socket.username, recipient, message]);
            } catch (error) {
                console.error('Error storing message in the database:', error);
            }
        } else {
            socket.emit('errorMessage', `User ${recipient} is not connected.`);
        }
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            io.emit('userLeft', socket.username);
        }
        console.log('A user disconnected');
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
