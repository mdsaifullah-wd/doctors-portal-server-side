const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
const res = require('express/lib/response');
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

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

    // Get booking
    app.get('/booking', async (req, res) => {
      const patient = req.query.patient;
      const bookings = await bookingCollection
        .find({ patientEmail: patient })
        .toArray();
      res.send(bookings);
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
      res.send(result);
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
