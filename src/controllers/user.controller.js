import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler( async (req,res) =>{
    const {email, password, username, fullName} = req.body;
    if([email,password,username,fullName].some(field => field.trim() === "")){
        throw new ApiError(400,"Some required fields are missing");
    }
    const isDuplicate = await User.findOne({$or:[{email:email},{username:username}]});
    if(isDuplicate){
        throw new ApiError(409,"User with email or username already exists");
    }
    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath; 
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required");
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    if(!avatar){
        throw new ApiError(400,"Avatar file is required");
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
   
    const user = await User.create({
        fullName,
        email,
        password,
        username: username.toLowerCase(),
        avatar:avatar.url,
        coverImage:coverImage?.url || ""
    });
    const createdUser = await User.findById(user?._id).select(
        "-password -refreshToken"
    )
    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering the user");
    }

    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered successfully!")
    );

});

export {registerUser};