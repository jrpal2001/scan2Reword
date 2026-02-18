import cors from 'cors';

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins =
     process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) ||
      [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'https://cheery-tiramisu-9e4ee7.netlify.app',
      'https://glistening-gecko-059136.netlify.app'
      
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

// ✅ Export as a middleware
export default cors(corsOptions);
