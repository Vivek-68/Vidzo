import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";


const registerUser = asyncHandler( async (req,res) =>{
    const {email, password, username, fullName} = req.body;
    if([email,password,username,fullName].some(field => field.trim() === "")){
        throw new ApiError(400,"Some required fields are missing");
    }
    const isDuplicate = User.findOne({$or:[{email:email},{username:username}]});
    if(isDuplicate){
        throw new ApiError(409,"User with email or username already exists");
    }
});

export {registerUser};