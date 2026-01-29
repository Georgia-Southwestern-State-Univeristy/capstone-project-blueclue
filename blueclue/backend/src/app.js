//src app.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

//test route 
app.get('/', (req, res) => {
    res.send('Welcome to BlueClue Backend!');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: "OK",
        message: "BlueClue API is running"
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});