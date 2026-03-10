import React, { useEffect, useState } from 'react'
import "../style/payment.css"
import {IoMdArrowRoundBack} from "react-icons/io"
import { Link } from 'react-router-dom'
import { useUserAuth } from '../context/Authcontext'
import {  ref, onValue, set, push } from "firebase/database";
import { database } from '../firebase-config/config'
import { RadioGroup, Radio, Button, Text, useToast, Modal, ModalOverlay, ModalContent, ModalHeader, ModalFooter, ModalBody, useDisclosure, Box } from '@chakra-ui/react'
import { PopoverProfile } from '../components/Popover'
import { TimeSelectModal } from '../components/TimeSelectModal'

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

export const Payment = () => {
  const {user} = useUserAuth();
  const [name,setName] = useState("")
  const [time,setTime] = useState("")
  const [amount, setAmount] = useState(0)
  const [bookingData, setBookingData] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('qr')
  const [loading, setLoading] = useState(false)
  const [showConflictModal, setShowConflictModal] = useState(false)
  const [showSlotModal, setShowSlotModal] = useState(false)
  const toast = useToast()

  const getUserData = (uid) => {
       const userRef = ref(database,"users/"+ uid);
       onValue(userRef,(snapshot)=>{
        const data = snapshot.val();
        console.log('Raw data from Firebase:', data);
        if(data===null || !data.data){
          console.log('No booking data found')
          return
        }else{
          const bookingInfo = data.data
          console.log('Booking info:', bookingInfo);
          console.log('Amount from DB:', bookingInfo.amount);
          setBookingData(bookingInfo)
          setName(bookingInfo.booking?.name || '')
          setTime(bookingInfo.time || '')
          setAmount(bookingInfo.amount || 0)
        }
        
       })
  }
  useEffect(()=>{
    if(user){
      getUserData(user.uid)
    }
  },[user])

  const OverlayOne = () => (
    <ModalOverlay
      bg='blackAlpha.300'
      backdropFilter='blur(10px) hue-rotate(90deg)'
    />
  )

  const OverlayTwo = () => (
    <ModalOverlay
      bg='none'
      backdropFilter='auto'
      backdropInvert='80%'
      backdropBlur='2px'
    />
  )

  const { isOpen, onOpen, onClose } = useDisclosure()
  const [overlay, setOverlay] = React.useState(<OverlayOne />)

  const handleRazorpayPayment = async () => {
    if (!bookingData || !bookingData.bookingId) {
      toast({ title: 'Error', description: 'Booking data not found', status: 'error' })
      return
    }

    // Validate booking data
    if (!bookingData.amount || bookingData.amount === 0) {
      toast({ title: 'Error', description: 'Invalid booking amount', status: 'error' })
      console.error('Invalid booking data:', bookingData)
      return
    }

    setLoading(true)
    try {
      console.log('Creating order with data:', {
        amount: bookingData.amount,
        bookingId: bookingData.bookingId,
        userEmail: bookingData.email,
        turfId: bookingData.turfId,
        bookingDate: bookingData.bookingDate,
        time: bookingData.time,
        userId: bookingData.uid,
      })

      // Step 1: Create Razorpay Order on Backend
      const orderResponse = await fetch(`${BACKEND_URL}/api/payment/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: bookingData.amount,
          bookingId: bookingData.bookingId,
          userEmail: bookingData.email,
          turfId: bookingData.turfId,
          bookingDate: bookingData.bookingDate,
          time: bookingData.time,
          userId: bookingData.uid,
        }),
      })

      console.log('Order response status:', orderResponse.status)

      if (orderResponse.status === 409) {
        // Turf already booked for this slot
        setShowConflictModal(true)
        setLoading(false)
        return
      }

      if (orderResponse.status === 400) {
        const errorData = await orderResponse.json()
        toast({ title: 'Validation Error', description: errorData.error || 'Invalid booking data', status: 'error' })
        console.error('Validation error:', errorData)
        setLoading(false)
        return
      }

      if (orderResponse.status === 500) {
        const errorData = await orderResponse.json()
        toast({ title: 'Server Error', description: errorData.error || errorData.details || 'Failed to create payment order', status: 'error' })
        console.error('Server error:', errorData)
        setLoading(false)
        return
      }

      const orderData = await orderResponse.json()
      console.log('Order data received:', orderData)
      
      if (!orderData.success) {
        toast({ title: 'Error', description: orderData.error || orderData.message || 'Failed to create order', status: 'error' })
        console.error('Order creation failed:', orderData)
        setLoading(false)
        return
      }

      // Step 2: Load Razorpay Script
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      document.head.appendChild(script)

      script.onload = () => {
        console.log('Razorpay script loaded, opening checkout modal')
        
        // Step 3: Open Razorpay Checkout
        const options = {
          key: process.env.REACT_APP_RAZORPAY_KEY_ID,
          order_id: orderData.orderId,
          amount: orderData.amount,
          currency: orderData.currency,
          name: 'Turfz Booking',
          description: `Booking for ${name}`,
          prefill: {
            email: bookingData.email,
            contact: user.phoneNumber || '',
          },
          theme: {
            color: '#F37254',
          },
          handler: handlePaymentSuccess,
          modal: {
            ondismiss: () => {
              setLoading(false)
              toast({ title: 'Payment Cancelled', status: 'warning' })
            }
          }
        }

        console.log('Opening Razorpay with options:', options)
        const rzp = new window.Razorpay(options)
        rzp.open()
      }
      
      script.onerror = () => {
        console.error('Razorpay script failed to load')
        toast({ title: 'Error', description: 'Failed to load Razorpay payment gateway', status: 'error' })
        setLoading(false)
      }
    } catch (error) {
      console.error('Payment error:', error)
      toast({ title: 'Error', description: error.message, status: 'error' })
      setLoading(false)
    }
  }

  // Save booking to history and set as current
  const saveBookingToHistory = async (paymentInfo = {}) => {
    try {
      // Save as current booking
      await set(ref(database, "users/" + user.uid + "/data"), {
        ...bookingData,
        paymentStatus: paymentInfo.status || 'Confirmed',
        approvalStatus: bookingData.approvalStatus || 'Pending',
        paymentId: paymentInfo.paymentId || null,
        orderId: paymentInfo.orderId || null,
      })

      // Also append to booking history
      await push(ref(database, "users/" + user.uid + "/bookings"), {
        ...bookingData,
        paymentStatus: paymentInfo.status || 'Confirmed',
        approvalStatus: bookingData.approvalStatus || 'Pending',
        paymentId: paymentInfo.paymentId || null,
        orderId: paymentInfo.orderId || null,
        createdAt: Date.now(),
      })
    } catch (err) {
      console.error('Failed to save booking:', err)
      throw err
    }
  }

  // Handle successful payment
  const handlePaymentSuccess = async (response) => {
    try {
      // Step 4: Verify Payment on Backend
      const verifyResponse = await fetch(`${BACKEND_URL}/api/payment/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: response.razorpay_order_id,
          paymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
          bookingId: bookingData.bookingId,
        }),
      })

      const verifyData = await verifyResponse.json()

      if (verifyData.success) {
        // Step 5: Update Booking Status in Database using helper
        await saveBookingToHistory({
          status: 'Confirmed',
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
        })

        toast({ 
          title: 'Payment Successful!', 
          description: 'Your booking has been confirmed', 
          status: 'success',
          duration: 5,
          isClosable: true 
        })
        
        setLoading(false)
        // Modal will show success message
        setOverlay(<OverlayTwo />)
        onOpen()
      } else {
        toast({ title: 'Verification Failed', description: verifyData.message, status: 'error' })
        setLoading(false)
      }
    } catch (error) {
      console.error('Verification error:', error)
      toast({ title: 'Error', description: 'Payment verification failed', status: 'error' })
      setLoading(false)
    }
  }

  return (
    <div id='paymentContainer'>
          <div id="paymentNav">
            <Link to={"/turf"}>
             <IoMdArrowRoundBack fontWeight={"bold"} fontSize="30px"/>
             </Link>
             <p id='BookedTurfName'>{name}</p>
             <PopoverProfile email={user.email}/>
          </div>
          <div id='paymentContainerBox'>
            <div id='paymentMode'>
            <Text className="payment-header" fontWeight={"bold"} fontSize="22px">Pay Now</Text>
            <Text className="payment-amount" fontSize="16px" color="gray.600" mt={1}>Amount: ₹{amount}</Text>
            
            {/* Test Card Info */}
            {process.env.NODE_ENV === 'development' && (
              <Box mt={3} p={3} className="testCardBox">
                <Text fontSize="sm" fontWeight="bold">ℹ️ Test Mode</Text>
                <Text fontSize="xs" mt={1}>
                  Card: 4111111111111111 | CVV: 123 | Date: 12/25
                </Text>
              </Box>
            )}
            
            <Box mt={4}>
              <RadioGroup value={paymentMethod} onChange={setPaymentMethod}>
                <div className="payment-methods">
                  <Radio value="qr">Pay Online (Card/UPI/Wallet)</Radio>
                  <Radio value="cash">Pay with Cash (Manual)</Radio>
                </div>
              </RadioGroup>
            </Box>
      <Button
        onClick={async () => {
          if (paymentMethod === 'qr') {
            handleRazorpayPayment()
          } else {
            // For cash payment, save booking immediately
            setLoading(true)
            try {
              await saveBookingToHistory({ status: 'Pending - Cash Payment' })
              setLoading(false)
              setOverlay(<OverlayTwo />)
              onOpen()
            } catch (err) {
              toast({ title: 'Error', description: 'Failed to save booking', status: 'error' })
              setLoading(false)
            }
          }
        }}
        colorScheme="red"
        mt={4}
        isLoading={loading}
        width="100%"
      >
        {loading ? 'Processing...' : 'Pay Now'}
      </Button>
      <Modal isCentered isOpen={isOpen} onClose={onClose}>
        {overlay}
        <ModalContent>
          <ModalHeader>Order Booked</ModalHeader>
          <ModalBody>
            <Text>Thanks for booking {name}</Text>
            <Text>Time : {time}</Text>
            <Text mt={4} fontWeight="bold" color="green.500">Payment Status: {bookingData?.paymentStatus}</Text>
          </ModalBody>
          <ModalFooter>
            <Link to="/turf">
            <Button onClick={onClose} colorScheme="red">Back to Turfs</Button>
            </Link>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Booking Conflict Modal */}
      <Modal isOpen={showConflictModal} onClose={() => setShowConflictModal(false)} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader fontWeight="bold" color="red.500">Turf Slot Busy</ModalHeader>
          <ModalBody>
            <Text fontSize="lg" mb={2}>Bro, please choose another time. This turf is busy at your selected slot.</Text>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="red" onClick={() => {
              setShowConflictModal(false);
              setShowSlotModal(true);
            }}>OK</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Slot Selection Modal (reuse your slot picker/modal) */}
      {showSlotModal && (
        <TimeSelectModal isOpen={showSlotModal} onClose={() => setShowSlotModal(false)} />
      )}
             </div>
          </div>
    </div>
  )
}
