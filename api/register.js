// api/register.js
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

// Obtenemos la cadena de conexión de las variables de entorno de Vercel
const MONGODB_URI = process.env.MONGODB_URI;

export default async function handler(req, res) {
  // Solo permitimos peticiones POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { username, password } = req.body;

    // Validaciones básicas
    if (!username || !password || password.length < 6) {
      return res.status(400).json({ message: 'Usuario y contraseña son requeridos. La contraseña debe tener al menos 6 caracteres.' });
    }

    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db('ranmafic'); // Puedes nombrar tu base de datos como quieras (ej. 'ranmafic_db')

    // Verificar si el usuario ya existe
    const existingUser = await db.collection('users').findOne({ username: username.toLowerCase() });
    if (existingUser) {
      client.close();
      return res.status(422).json({ message: 'El nombre de usuario ya existe.' });
    }

    // Hashear (encriptar) la contraseña antes de guardarla
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insertar el nuevo usuario
    await db.collection('users').insertOne({
      username: username.toLowerCase(),
      password: hashedPassword,
      avatar: '', // Puedes dejar el avatar vacío inicialmente
      role: 'usuario', // Todos los nuevos usuarios tienen el rol 'usuario'
      createdAt: new Date(),
    });

    client.close();

    res.status(201).json({ message: '¡Usuario registrado con éxito!' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
}