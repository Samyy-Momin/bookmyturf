import React, { useEffect, useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  useDisclosure,
  Text,
  Alert,
  AlertIcon,
  Box,
  Input
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useUserAuth } from "../context/Authcontext";
import { ref, set, onValue } from "firebase/database";
import { database } from "../firebase-config/config";

const time = [
  "5:00 AM",
  "7:00 AM",
  "9:00 AM",
  "4:00 PM",
  "6:00 PM",
  "8:00 PM",
  "10:00 AM",
];

// Helper function to convert time string to Date object
const getTimeAsDate = (timeStr, dateStr) => {
  const [timePart, period] = timeStr.split(' ');
  let [hours, minutes] = timePart.split(':').map(Number);
  
  if (period === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period === 'AM' && hours === 12) {
    hours = 0;
  }
  
  const date = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  return date;
};

// Check if a time slot is in the past
const isTimePast = (timeStr, dateStr) => {
  if (!dateStr) return false;
  const slotDateTime = getTimeAsDate(timeStr, dateStr);
  const now = new Date();
  return slotDateTime < now;
};
export const TimeSelectModal = (prop) => {
  const { turf, element, setElement, setTime, setTurfName, turfName } = prop;
  const { user } = useUserAuth();

  const OverlayTwo = () => (
    <ModalOverlay
      bg="none"
      backdropFilter="auto"
      backdropInvert="80%"
      backdropBlur="2px"
    />
  );
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [overlay] = React.useState(<OverlayTwo />);
  const [bookedtime, setBookedTime] = useState([]);
  const [link, setlink] = useState(false);
  const [msg, setMsg] = useState(false);
  const [err, setErr] = useState(false);
  const [date,setDate] = useState("")

  const handleElement = (ele) => {
    setElement(ele);
    setTurfName(ele.name)
  };
  // const bookedTimeLs = localStorage.getItem("time", time);
  // console.log(bookedTime)
  const navigate = useNavigate();
  // add bookings to user account
  // NOTE: previously this replaced the whole user node which deleted the
  // bookings history. Only write the active booking under /users/<uid>/data
  function writeUserData(data) {
    set(ref(database, "users/" + user.uid + "/data"), data);
  }

// console.log(date)
  // const getBookings = () => {
  //   let arr = [];
  //   const Leaveref = ref(database, `users/`);
  //   onValue(Leaveref, (snapshot) => {
  //     const data = snapshot.val();
  //     const newLeave = Object.keys(data).map((key) => ({
  //       id: key,
  //       ...data[key],
  //     }));
  //     newLeave.map((ele) => {
  //       return arr.push(ele.data.time);
  //     });
  //   });
  //   setBookedTime(arr);
  // };
  useEffect(() => {
    const Leaveref = ref(database, `users/`);
    let arr = [];
    onValue(Leaveref, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        // no bookings yet
        setBookedTime([]);
        return;
      }
      const newLeave = Object.keys(data).map((key) => ({
        id: key,
        ...data[key],
      }));
      newLeave.map((ele) => {
       return arr.push(ele.data);
      });
      setBookedTime(arr);
    });
  },[]);

  const addBookings = async (ele) => {
    try {
      const userAuth = await user;
      var bookingData = {
        booking: element,
        time: ele,
        uid: userAuth.uid,
        email: userAuth.email,
        bookingDate : date,
        bookingId: `${userAuth.uid}_${Date.now()}`,
        amount: element.price,
        turfId: element.id,
        paymentStatus: 'Pending',
        approvalStatus: 'Pending',
        paymentId: null,
        orderId: null
      };
      console.log('Booking data being saved:', bookingData);
      console.log('Element price:', element.price);
      console.log('Element:', element);
      
      if (bookedtime.find((e) =>e.time === ele && e.bookingDate=== date && e.booking.name===turfName) ) {
        setlink(false)
        setErr(true)
      } else {
        setlink(true)
        writeUserData(bookingData);
        setMsg(true)
      }
    } catch (err) {
      console.log(err);
    }
  };

  // Navigate when link is true (use effect to avoid setState during render)
  useEffect(() => {
    if (link) {
      navigate("/payment");
    }
  }, [link, navigate]);

  return (
    <>
      <Button
        colorScheme={"red"}
        onClick={() => {
          handleElement(element);
          onOpen();
        }}
      >
        Book Now
      </Button>
      <Modal isCentered isOpen={isOpen} onClose={onClose}>
        {overlay}
        <ModalContent>
          <ModalHeader>Timings For {turf}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box>
             
              {msg ? (
                <div className={msg ? "alertMsg" : "alertErr"}>
                  <Alert status="success">
                    <AlertIcon />
                    Booked successfully
                  </Alert>
                </div>
              ) : (
                <div className={err ? "errmsg" : "errFalse"}>
                  <Alert status="error">
                    <AlertIcon />
                     This Slot is already Booked
                  </Alert>
                </div>
              )}
            </Box>
            <Text fontWeight={"bold"} fontSize="25px" color={"red"}>Booking for "{turfName}"</Text>
            <Text fontWeight={"bold"} fontSize="25px">Select Date</Text>
            <Input 
              type={"date"} 
              min={new Date().toISOString().split('T')[0]}
              onChange={(e)=>setDate(e.target.value)}
              value={date}
            />
            <Text fontWeight={"bold"} fontSize="25px">
              Select Time
            </Text>
            <div id="timeButtons">
              {time.map((ele, idx) => {
                const isPast = isTimePast(ele, date);
                return (
                  <Button
                    key={idx}
                    colorScheme={"red"}
                    isDisabled={isPast}
                    opacity={isPast ? 0.5 : 1}
                    cursor={isPast ? 'not-allowed' : 'pointer'}
                    onClick={() => {
                      if (!isPast) {
                        setTime(ele);
                        addBookings(ele);
                      }
                    }}
                    title={isPast ? "This slot has already passed" : ""}
                  >
                    {ele} {isPast ? "(Passed)" : ""}
                  </Button>
                );
              })}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onClick={onClose}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
