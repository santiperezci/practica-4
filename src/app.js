import { MongoClient, ObjectID } from "mongodb";
import { GraphQLServer } from "graphql-yoga";
import * as uuid from 'uuid';
import "babel-polyfill";

const usr = "sperezcirerap";
const pwd = "spc99";
const url = "cluster0-f5jg6.gcp.mongodb.net/test?retryWrites=true&w=majority";


/**
 * Connects to MongoDB Server and returns connected client
 * @param {string} usr MongoDB Server user
 * @param {string} pwd MongoDB Server pwd
 * @param {string} url MongoDB Server url
 */
const connectToDb = async function(usr, pwd, url) {
  const uri = `mongodb+srv://${usr}:${pwd}@${url}`;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  await client.connect();
  return client;
};

/**
 * Starts GraphQL server, with MongoDB Client in context Object
 * @param {client: MongoClinet} context The context for GraphQL Server -> MongoDB Client
 */
const runGraphQLServer = function(context) {
  const typeDefs = `
    type Query{
      logIn(name:String!, password:String!):ID
      logOut(name:String!, password:String!):ID
      getFacturas(name: String!, token:String!):[Factura]!
    }
    type Mutation{
        addTitular(name:String!, password:String!):Titular!
        addFactura(concept:String!, quantity:Float!, titular: String!):Factura!
        removeUser(name:String!, token:String!):Titular!
    }
    type Factura{
      date: String!
      concept: String!
      quantity: Float!
      titular: Titular!
    }
    type Titular{
        name: String!
        password: String!
        facturas: [Factura!]
        token: ID
    }
    `;

  const resolvers = {

    Query: {
        logIn: async (parent, args, ctx, info) => {
            const {name,password} = args;
            const {client} = ctx;
            const db = client.db("Prac_3");
            const user_collection = db.collection("users");
            const result = await user_collection.findOne({name: name, password: password});
            if(result){
                const token = uuid.v1();
                await user_collection.updateOne({name: name},{$set:{token: token}});
                return token;
            }
            else{
                throw new Error("User/password incorrect");
            }
            
        },
        logOut: async (parent, args, ctx, info) => {
            const {name,password} = args;
            const {client} = ctx;
            const db = client.db("Prac_3");
            const user_collection = db.collection("users");
            const result = await user_collection.findOne({name: name, password: password});
            if(result){
                await user_collection.updateOne({name: name},{$set:{token: null}});
                return result.token;
            }
            else{
                throw new Error("User/password incorrect");
            }
            
        },
        getFacturas: async (parent, args, ctx, info) => {
            const {name,token} = args;
            const {client} = ctx;
            const db = client.db("Prac_3");
            const user_collection = db.collection("users");
            const factura_collection = db.collection("facturas");
            const f_user = await user_collection.findOne({name: name});
            if(f_user.token == token){
              return await factura_collection.find({titular: f_user._id}).toArray();

            }
            else{
                throw new Error("User not logged");
            }
            
        },


    },
    
    Mutation: {
        addTitular: async (parent, args, ctx, info) => {
            const {name,password} = args;
            const {client} = ctx;
            const db = client.db("Prac_3");
            const collection = db.collection("users");
            if(await collection.findOne({name: name})){
                throw new Error("That author already exist");
            }
            const result = await collection.insertOne({name,password,token: null});
            return {
                id: result.ops[0]._id,
                name,
                password,
            };
          },
          addFactura: async (parent, args, ctx, info) => {
            const {concept, quantity, titular} = args;
            const {client} = ctx;
            const db = client.db("Prac_3");
            const user_collection = db.collection("users");
            const factura_collection = db.collection("facturas");
            const f_user = await user_collection.findOne({name: titular});
            if(f_user.token){
                const d = new Date();
                const date = `${d.getDate()}-${d.getMonth()}-${d.getFullYear()}`;
                const result = await factura_collection.insertOne({date: date, concept,quantity,titular:f_user._id});

                return {
                    id: result.ops[0]._id,
                    date,
                    concept,
                    quantity,
                    titular: f_user._id
                };
            }
            else{
                throw new Error("The user is not loged or nor exist");
            } 
          },
          removeUser: async (parent, args, ctx, info) => {
            const {name, token} = args;
            const {client} = ctx;
            const db = client.db("Prac_3");
            const user_collection = db.collection("users");
            const factura_collection = db.collection("facturas");
            const f_user = await user_collection.findOne({name});
            if(f_user.token == token){
                await user_collection.deleteOne({name,token});
                await factura_collection.deleteMany({titular: f_user.token});
                return f_user;
            }
            else{
                throw new Error("The user is not loged or nor exist");
            } 
          }
    }
  };

  const server = new GraphQLServer({ typeDefs, resolvers, context });
  const options = {
    port: 3004
  };

  try {
    server.start(options, ({ port }) =>
      console.log(
        `Server started, listening on port ${port} for incoming requests.`
      )
    );
  } catch (e) {
    console.info(e);
    server.close();
  }
};

const runApp = async function() {
  const client = await connectToDb(usr, pwd, url);
  console.log("Connect to Mongo DB");
  try {
    runGraphQLServer({ client });
  } catch (e) {
      console.log(e);
    client.close();
  }
};

runApp();
