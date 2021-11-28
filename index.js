const express = require("express");
const cors = require("cors");
var admin = require("firebase-admin");
require("dotenv").config();
const MongoClient = require("mongodb").MongoClient;
const ObjectId = require("mongodb").ObjectId;
const stripe = require('stripe')(process.env.STRIPE_SECRET)

const port = process.env.PORT || 5000;
const app = express();
app.use(cors());
app.use(express.json());


var serviceAccount = require("./kick-off-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

//mongodb connect
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.elhzr.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }

    }
    next();
}

async function run(){
  try{
    await client.connect();
    const database = client.db('KickOff')
    const myOrdersCollection = database.collection('myOrders');
    const usersCollection = database.collection('users');
    const reviewsCollection = database.collection('reviews');
    const productsCollection = database.collection('products');
    const AllProductsCollection = database.collection('allProducts');

    app.get('/allProducts', async (req, res) => {
      const cursor = productsCollection.find({});
      const products = await cursor.toArray();
      res.json(products);
    })

    app.get('/products', async (req, res) => {
      const surface = req.query.surface;  
      const query = {category: surface};
      const cursor = productsCollection.find(query);
      const products = await cursor.toArray();
      res.json(products);
    })

    app.post('/products', async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.json(result)
    })

    // app.put('/products/:id', async (req, res) => {
    //   const id = req.params.id;
    //   const details = req.body;
    //   const filter = {_id:ObjectId(id)};
    //   const updateDoc = {
    //     $set: {
    //       details
    //     }
    //   }
    //   const result = await productsCollection.updateOne(filter, updateDoc);
    //   res.json(result);
    // })

    app.delete('/products/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id:ObjectId(id)};
      const result = await  productsCollection.deleteOne(query);
      res.json(result);
    })

    app.get('/orders', async (req, res) => {
      const cursor = myOrdersCollection.find({});
      const orders = await cursor.toArray();
      res.json(orders);
    })

    // updating action statue
    app.put('/orders/:id', async (req, res) => {
      const id = req.params.id;
      const statue = req.body;
      const filter = {_id:ObjectId(id)};
      const updateDoc = {
        $set: {
          statue: statue.statue
        }
      }
      const result = await myOrdersCollection.updateOne(filter, updateDoc);
      res.json(result);
    })

    app.get('/myOrders', async (req, res) => {
      const email = req.query.email;  
      const query = {email: email};
      const cursor = myOrdersCollection.find(query);
      const myOrders = await cursor.toArray();
      res.json(myOrders);
    })

    app.post('/myOrders', verifyToken, async (req, res) => {
      const myOrders = req.body;
      const result = await myOrdersCollection.insertOne(myOrders);
      res.json(result)
    })

    app.delete('/myOrders/:id', async (req, res) => {
      const id = req.params.id;
      const query = {_id:ObjectId(id)};
      const result = await  myOrdersCollection.deleteOne(query);
      res.json(result);
    })

    app.get('/users/:email', async (req, res)=>{
      const email = req.params.email;
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if(user?.role === 'admin'){
        isAdmin = true;
      }
      res.json({admin: isAdmin})
    })

    app.post('/users', async(req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      console.log(result)
      res.json(result)
    });

    app.put('/users', async(req, res) => {
      const user = req.body;
      const filter = {email: user.email};
      const options = {upsert: true}
      const updateDoc = {$set: user};
      const result = await usersCollection.updateOne(filter, updateDoc, options);
      res.json(result);
    });

    app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to make admin' })
            }

        })

    app.get('/reviews', async (req, res) => {
      const cursor = reviewsCollection.find({});
      const reviews = await cursor.toArray();
      res.json(reviews);
    })

    app.post('/reviews', async (req, res) => {
      const reviews = req.body;
      const result = await reviewsCollection.insertOne(reviews);
      res.json(result)
    })

    app.post('/create-payment-intent', async (req, res) => {
            const paymentInfo = req.body;
            const amount = paymentInfo.price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                payment_method_types: ['card']
            });
            res.json({ clientSecret: paymentIntent.client_secret })
        })

  }
  finally{

  }
}
run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('Welcome in Kick Off!')
})

app.listen(port, () => {
    console.log(`Serer is running on port ${port}`)
})