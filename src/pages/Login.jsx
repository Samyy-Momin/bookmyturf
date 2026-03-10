import { Input, Button } from '@chakra-ui/react'
import React, { useState } from 'react'
import loginBg from "../images/loginBg.png"
import googleimg from "../images/search.png"
import "../style/login.css"
import { Link ,useNavigate, useLocation } from "react-router-dom";
import { useUserAuth } from "../context/Authcontext";
import { Alert } from "@chakra-ui/react";

export const Login = () => {
    const [email,setEmail] = useState("");
    const [pass,setPass] = useState("")
    const [error,setError] = useState("")
    const {login,googleSignin} = useUserAuth()
    const navigate = useNavigate()
    const location = useLocation()

    // handle sign in 
    const handlesignin = async() => {
      try{
        await login(email,pass)
        alert("Login Successfully")
        // redirect to requested page (e.g. /admin) when provided
        const params = new URLSearchParams(location.search);
        const next = params.get("next") || "/turf";
        navigate(next);
      }catch(err){
        setError(err.message)
      } 
    }
    const signinWithgoogle = async() => {
      try{
       await googleSignin()
       const params = new URLSearchParams(location.search);
        const next = params.get("next") || "/turf";
        navigate(next);
      }catch(err){
        console.log(err)
      }
    }
  return (
    <div id='loginContainer'>
        <div id='loginBg'>
            <img src={loginBg} alt="" />
        </div>
        <div id='loginform'>
            <h1 id='headingLogin'>LOGIN</h1>
            {
            error && <Alert variant={"subtle"} status='error'>{error}</Alert>
           }
            <div>
              <p id='username'>EMAIL</p>
              <Input type="text" placeholder='EMAIL' onChange={(e)=>setEmail(e.target.value)} border="2px solid black"/>
            </div>
            <div>
               <p id='password'>PASSWORD</p>
               <Input type="password" placeholder='PASSWORD' onChange={(e)=>setPass(e.target.value)} border="2px solid black"/>
            </div>
            <Button id='loginFormBtn' onClick={handlesignin}>Login</Button>
            <Button id='loginwithBtn' onClick={signinWithgoogle}>
              <div id='glogo'>
                <img src={googleimg} alt="" />
              </div>
              <p id='gtext'>Login with Google</p>
            </Button>
             <p>Don't have an account? <Link to={"/signup"}>Sign Up</Link></p>
        </div> 
    </div>
  )
}
