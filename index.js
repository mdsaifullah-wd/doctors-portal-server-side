const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: 'Unauthorized Access' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: 'Forbidden Access' });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.USER_ID}:${process.env.USER_PASSWORD}@cluster0.tzbrj.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const runMongo = async () => {
  try {
    await client.connect();
    const serviceCollection = client.db('doctorsportal').collection('services');
    const bookingCollection = client.db('doctorsportal').collection('bookings');
    const userCollection = client.db('doctorsportal').collection('users');

    // Get all Services
    app.get('/services', async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
      const services = await cursor.toArray();
      res.send(services);
    });

    // Available Services
    app.get('/available', async (req, res) => {
      const date = req.query.date;
      const services = await serviceCollection.find().toArray();
      const bookings = await bookingCollection.find({ date }).toArray();
      services.forEach((service) => {
        const serviceBookings = bookings.filter(
          (booking) => booking.treatment === service.name
        );
        const booked = serviceBookings.map((booking) => booking.slot);
        service.slots = service.slots.filter((slot) => !booked.includes(slot));
      });
      res.send(services);
    });

    // Post booking
    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = {
        treatmentId: booking.treatmentId,
        patientEmail: booking.patientEmail,
        date: booking.date,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ status: false, booking: exists });
      } else {
        const result = await bookingCollection.insertOne(booking);
        return res.send({ status: true, result });
      }
    });

    // Get Appointment/Booking
    app.get('/booking', verifyToken, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const patient = req.query.patient;
      if (patient === decodedEmail) {
        const bookings = await bookingCollection
          .find({ patientEmail: patient })
          .toArray();
        return res.send(bookings);
      } else {
        return res.status(403).send({ message: 'Forbidden Access!' });
      }
    });

    // Update User
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };

      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '1h',
      });
      res.send({ result, token });
    });

    // Get All Users
    app.get('/user', verifyToken, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Is Admin?
    app.get('/user/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send(isAdmin);
    });

    // Make Admin
    app.put('/admin/add/:email', verifyToken, async (req, res) => {
      const requester = req.decoded.email;
      const requesterDetails = await userCollection.findOne({
        email: requester,
      });
      if (requesterDetails.role === 'admin') {
        const email = req.params.email;
        const filter = { email: email };
        const updateDoc = {
          $set: {
            role: 'admin',
          },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        res.status(403).send({ message: 'Forbidden Access' });
      }
    });

    // Remove Admin
    app.put('/admin/remove/:email', verifyToken, async (req, res) => {
      const requester = req.decoded.email;
      const requesterDetails = await userCollection.findOne({
        email: requester,
      });
      if (requesterDetails.role === 'admin') {
        const email = req.params.email;
        const filter = { email: email };
        const updateDoc = {
          $set: {
            role: 'user',
          },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      } else {
        res.status(403).send({ message: 'Forbidden Access' });
      }
    });
  } finally {
  }
};
runMongo().catch(console.error);

app.get('/', (req, res) => {
  res.send('Test');
});

app.listen(port, () => {
  console.log('Server is running...');
});
