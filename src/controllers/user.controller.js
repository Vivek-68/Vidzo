import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();
    
        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave:false}); //read about it
        return{
            accessToken,refreshToken
        }
    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating access and refresh tokens!")
    }
    
   
}

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

const loginUser = asyncHandler(async(req,res)=>{
    const {username,email,password} = req.body;
    if(!(username || email)){
        throw new ApiError(401,"Username or email required!");
    }
    const user = await User.findOne({
        $or:[{username},{email}]
    });
    if(!user){
        throw new ApiError(401,"No user with entered email or username exists!");
    }
    const verifiedPassword = await user.isPasswordCorrect(password);
    if(!verifiedPassword){
        throw new ApiError(401,"Password is incorrect!");
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id);
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");
    const options = {
        httpOnly:true,
        secure:true
    }
    

    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(200,{
            user:loggedInUser, accessToken, refreshToken
        },
        "User logged in successfully!")
    );
    
});

const logoutUser = asyncHandler(async(req,res)=>{
await User.findByIdAndUpdate(
    req.user._id,{
        $set:{
            refreshToken:undefined
        }
    },{
        new:true // read
    }
)
const options = {
    httpOnly:true,
    secure:true
}

return res.status(200).
clearCookie("accessToken",options).
clearCookie("refreshToken",options).
json(
    new ApiResponse(200,{},"User logged out successfully!")
)
});

const refreshAccessToken = asyncHandler(async(req,res)=>{
    try {
        const refreshToken = req.cookie?.refreshToken || req.body.refreshToken;
        if(!refreshToken){
            throw new ApiError(401,"Refresh token has expired!");
        }
        const decodedToken = jwt.verify(refreshToken,process.env.REFRESH_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id);
        if(!user){
            throw new ApiError(401,"Invalid refresh token!");
        }
        if(user?.refreshToken !== refreshToken){
            throw new ApiError(401,"Invalid refresh token!");
        }
        const {accessToken,newRefreshToken} = generateAccessAndRefreshTokens(user._id);
        const options = {
            httpOnly:true,
            secure:true
        };
        return res.status(200)
        .res.cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(200,{
                accessToken,refreshToken:newRefreshToken
            },"Access token refreshed!")
        );
        
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token!")
    }
});

const changePassword = asyncHandler(async(req,res) =>{
    try {
        const {password,newPassword} = req.body;
        if(!password || !newPassword){
            throw new ApiError(400,"All fields are required!");
        }
        const user = await User.findById(req.user?._id);
        if(!user){
            throw new ApiError(400,"User not found!");
        }
        if(! (await user.isPasswordCorrect(password))){
            throw new ApiError(400,"Old password is incorrect!");
        }
        user.password = newPassword;
        await user.save({validateBeforeSave:false});
        return res.status(200)
        .json(
            new ApiResponse(200,{},"Passwords successfully changed!")
        )
    } catch (error) {
        throw new ApiError(400,error?.message || "Something went wrong while changing password!")
    }
});

const getCurrentUser = asyncHandler(async(req,res) =>{
    const user = req.user;
    if(!user){
        throw new ApiError(400,"Could not get current user from req body!");
    }
    return res.status(200).json(
        new ApiResponse(200,user,"Fetched current user!")
    )
});

const updateAccountDetails = asyncHandler(async (req,res)=>{
    try {
        const {fullName,email} = req.body;
        if(!fullName || !email){
            throw new ApiError(400,"All fields are required!");
        }
        const user = await User.findByIdAndUpdate(req.user?._id,
                {
                    $set:{
                        fullName,email
                    }
                }  ,
                {
                    new:true
                }
            ).select("-password -refreshToken");
        if(!user){
            throw new ApiError(400,"Could not find user in req object");
        }

        return res.status(200)
        .json(
            new ApiResponse(200,user,"Account details changed successfully!")
        )
       
    } catch (error) {
        throw new ApiError(error?.message || "Something went wrong while changing account details!");
    }
})

const updateUserAvatar = asyncHandler(async (req,res) =>{
    try {
        const avatarLocalPath = req.file?.path;
        if(!avatarLocalPath){
            throw new ApiError(400,"Avatar image file is missing!");
        }
        const avatar = uploadOnCloudinary(avatarLocalPath);
        if(!avatar?.url){
            throw new ApiError(500,"Error while uploading avatar to cloudinary");
        }
        const user = await User.findByIdAndUpdate(req.user?._id,
            {
                $set:{
                    avatar:avatar?.url
                }
            },
            {
                new:true
        }).select("-password -refreshToken");

        return res.status(200)
        .json(
            new ApiResponse(200,user,"Avatar image successfully updated!")
        );
        
     
    }
    catch(error){
        throw new ApiError(400,error?.message || "Something went wrong while updating avatar image!")
    } 
})

const updateUserCoverImage = asyncHandler(async (req,res) =>{
    try {
        const coverImageLocalPath = req.file?.path;
        if(!coverImageLocalPath){
            throw new ApiError(400,"Cover image file is missing!");
        }
        const coverImage = uploadOnCloudinary(coverImageLocalPath);
        if(!coverImage?.url){
            throw new ApiError(500,"Error while uploading cover image to cloudinary");
        }
        const user = await User.findByIdAndUpdate(req.user?._id,
            {
                $set:{
                    coverImage:coverImage?.url
                }
            },
            {
                new:true
        }).select("-password -refreshToken");

        return res.status(200)
        .json(
            new ApiResponse(200,user,"Cover image successfully updated!")
        );
        
     
    }
    catch(error){
        throw new ApiError(400,error?.message || "Something went wrong while updating cover image!")
    } 
})

export 
{   registerUser,loginUser,logoutUser,
    refreshAccessToken,changePassword,getCurrentUser,
    updateAccountDetails,updateUserCoverImage,updateUserAvatar
};