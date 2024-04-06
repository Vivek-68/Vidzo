import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async() =>{
    try{
        const connectionResponse = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
        console.log("Database connected! Host: ",connectionResponse.connection.host);
    }
    catch(e){
        console.error("Database connection failed!", e);
        process.exit(1);
    }
}

export default connectDB;