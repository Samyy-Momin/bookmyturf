/*
  Admin page - Turf & Booking Management
*/
import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase-config/config";
import { database } from "../firebase-config/config";
import { ref, onValue, update } from "firebase/database";
import { useUserAuth } from "../context/Authcontext";
import {
  Box,
  Button,
  Input,
  Select,
  Image,
  SimpleGrid,
  Text,
  Stack,
  Heading,
  useToast,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";

const SPORTS = ["cricket", "football", "basketball", "badminton"];

export const Admin = () => {
  const { user, logout } = useUserAuth();
  const toast = useToast();
  const adminEmail = process.env.REACT_APP_ADMIN_EMAIL || "admin@example.com";

  const [sport, setSport] = useState(SPORTS[0]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [price, setPrice] = useState(0);
  const [image, setImage] = useState("");
  const [turfs, setTurfs] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const canEdit = user && user.email === adminEmail;
  const navigate = useNavigate();

  // Fetch all turfs
  async function fetchAll() {
    try {
      const results = [];
      for (const s of SPORTS) {
        const ref = collection(db, s);
        const snap = await getDocs(ref);
        snap.docs.forEach((d) => {
          results.push({ id: d.id, sport: s, ...d.data() });
        });
      }
      setTurfs(results);
    } catch (err) {
      console.error("failed to fetch turfs", err);
      toast({ title: "Failed to load turfs", status: "error", duration: 4000 });
    }
  }

  // Fetch all bookings from all users
  const fetchAllBookings = () => {
    const usersRef = ref(database, 'users');
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setAllBookings([]);
        return;
      }

      const bookings = [];
      Object.entries(data).forEach(([userId, userData]) => {
        // Add current booking
        if (userData.data) {
          bookings.push({
            userId,
            userName: userData.data.booking?.name || 'N/A',
            userEmail: userData.data.email || 'N/A',
            turfName: userData.data.booking?.name || 'N/A',
            bookingDate: userData.data.bookingDate || 'N/A',
            time: userData.data.time || 'N/A',
            amount: userData.data.amount || 0,
            paymentStatus: userData.data.paymentStatus || 'Pending',
            approvalStatus: userData.data.approvalStatus || 'Pending',
            bookingId: userData.data.bookingId,
            path: `users/${userId}/data`,
            type: 'current'
          });
        }

        // Add historical bookings
        if (userData.bookings) {
          Object.entries(userData.bookings).forEach(([bookingKey, booking]) => {
            bookings.push({
              userId,
              userName: booking.booking?.name || 'N/A',
              userEmail: booking.email || 'N/A',
              turfName: booking.booking?.name || 'N/A',
              bookingDate: booking.bookingDate || 'N/A',
              time: booking.time || 'N/A',
              amount: booking.amount || 0,
              paymentStatus: booking.paymentStatus || 'Pending',
              approvalStatus: booking.approvalStatus || 'Pending',
              bookingId: booking.bookingId,
              path: `users/${userId}/bookings/${bookingKey}`,
              type: 'history'
            });
          });
        }
      });

      setAllBookings(bookings);
    });
  };

  useEffect(() => {
    fetchAll();
    fetchAllBookings();
  }, []);

  const handleApprove = async (booking) => {
    try {
      const pathParts = booking.path.split('/');
      const updatePath = booking.path;
      const dbRef = ref(database, updatePath);
      
      await update(dbRef, { approvalStatus: 'Approved' });
      toast({ title: 'Booking Approved!', status: 'success' });
      onClose();
      fetchAllBookings();
    } catch (err) {
      console.error('Error approving booking:', err);
      toast({ title: 'Failed to approve', description: err.message, status: 'error' });
    }
  };

  const handleReject = async (booking) => {
    try {
      const dbRef = ref(database, booking.path);
      await update(dbRef, { approvalStatus: 'Rejected' });
      toast({ title: 'Booking Rejected!', status: 'success' });
      onClose();
      fetchAllBookings();
    } catch (err) {
      console.error('Error rejecting booking:', err);
      toast({ title: 'Failed to reject', description: err.message, status: 'error' });
    }
  };

  async function handleAdd(e) {
    e.preventDefault();
    if (!canEdit) {
      toast({ title: "Not authorised", status: "error", duration: 3000 });
      return;
    }
    if (!name) return toast({ title: "Enter name", status: "warning" });
    try {
      const ref = collection(db, sport);
      await addDoc(ref, { name, address, image, price: Number(price) });
      toast({ title: "Turf added", status: "success" });
      setName("");
      setAddress("");
      setImage("");
      setPrice(0);
      fetchAll();
    } catch (err) {
      console.error(err);
      const isPerm = err?.code === "permission-denied" || (err?.message && err.message.includes("Permission"));
      toast({
        title: isPerm ? "Permission denied" : "Failed to add turf",
        description: err?.message,
        status: "error",
        duration: 6000,
      });
    }
  }

  async function handleDelete(t) {
    if (!canEdit) {
      toast({ title: "Not authorised", status: "error", duration: 3000 });
      return;
    }
    try {
      await deleteDoc(doc(db, t.sport, t.id));
      toast({ title: "Deleted", status: "success" });
      fetchAll();
    } catch (err) {
      console.error(err);
      const isPerm = err?.code === "permission-denied" || (err?.message && err.message.includes("Permission"));
      toast({
        title: isPerm ? "Permission denied" : "Failed to delete",
        description: err?.message,
        status: "error",
        duration: 6000,
      });
    }
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'Approved': return 'green';
      case 'Rejected': return 'red';
      case 'Pending': return 'yellow';
      default: return 'gray';
    }
  };

  return (
    <Box p={6} maxW="1400px" mx="auto" bg="gray.900" minH="100vh">
      <Stack mb={6} spacing={3}>
        <Heading size="lg" color="white">Admin Panel</Heading>
        <Text color="gray.300">Logged in as: {user ? user.email : "Not logged in"}</Text>
        <Text fontSize="sm" color="gray.500">Configured admin: {adminEmail}</Text>
        <Box>
          <Menu>
            <MenuButton as={Button} rightIcon={<span style={{fontWeight:'bold'}}>&#9660;</span>} size="sm" variant="outline" mr={2}>
              Admin Actions
            </MenuButton>
            <MenuList>
              <MenuItem onClick={() => navigate('/change-password')}>Change Password</MenuItem>
              <MenuItem onClick={async () => { await logout(); navigate('/login'); }}>Logout</MenuItem>
            </MenuList>
          </Menu>
          {user && user.email !== adminEmail && (
            <Text color="orange.300" mt={2}>You are not the configured admin. Sign in as {adminEmail} to manage.</Text>
          )}
        </Box>
      </Stack>

      <Tabs>
        <TabList mb={4} borderBottomColor="gray.600">
          <Tab color="gray.300" _selected={{ color: 'red.500', borderBottomColor: 'red.500' }}>Turfs</Tab>
          <Tab color="gray.300" _selected={{ color: 'red.500', borderBottomColor: 'red.500' }}>Bookings</Tab>
        </TabList>

        <TabPanels>
          {/* TURFS TAB */}
          <TabPanel>
            <Box as="form" onSubmit={handleAdd} mb={8}>
              <SimpleGrid columns={[1, 2, 5]} gap={4}>
                <Select value={sport} onChange={(e) => setSport(e.target.value)} bg="gray.800" color="white" borderColor="gray.600">
                  {SPORTS.map((s) => (
                    <option key={s} value={s} style={{ background: '#2d3748', color: 'white' }}>
                      {s}
                    </option>
                  ))}
                </Select>
                <Input placeholder="Turf Name" value={name} onChange={(e) => setName(e.target.value)} bg="gray.800" color="white" borderColor="gray.600" />
                <Input placeholder="Location" value={address} onChange={(e) => setAddress(e.target.value)} bg="gray.800" color="white" borderColor="gray.600" />
                <Input placeholder="Price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} bg="gray.800" color="white" borderColor="gray.600" />
                <Input placeholder="Image URL" value={image} onChange={(e) => setImage(e.target.value)} bg="gray.800" color="white" borderColor="gray.600" />
                <Box>
                  {image && <Image src={image} alt="preview" maxH="160px" objectFit="cover" mb={2} />}
                  <Button colorScheme="blue" type="submit" isDisabled={!canEdit}>Add Turf</Button>
                </Box>
              </SimpleGrid>
            </Box>

            <Heading size="md" mb={4} color="white">All Turfs</Heading>
            <SimpleGrid columns={[1, 2, 3]} spacing={4}>
              {turfs.map((t) => (
                <Box key={`${t.sport}-${t.id}`} bg="gray.800" p={3} borderRadius="md" borderLeft="4px" borderColor="red.500">
                  {t.image && <Image src={t.image} alt={t.name} h="160px" objectFit="cover" mb={3} w="100%" />}
                  <Text fontWeight="bold" color="white">{t.name}</Text>
                  <Text fontSize="sm" color="gray.300">Location: {t.address}</Text>
                  <Text color="green.300">₹{t.price} / hour</Text>
                  <Text fontSize="xs" color="gray.400">Sport: {t.sport}</Text>
                  <Button mt={3} colorScheme="red" onClick={() => handleDelete(t)} isDisabled={!canEdit} size="sm">Delete</Button>
                </Box>
              ))}
            </SimpleGrid>
          </TabPanel>

          {/* BOOKINGS TAB */}
          <TabPanel>
            <Heading size="md" mb={4} color="white">All Bookings</Heading>
            <Box overflowX="auto" bg="gray.800" borderRadius="md" p={3}>
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr borderBottomColor="gray.600">
                    <Th color="gray.300">Customer Name</Th>
                    <Th color="gray.300">Email</Th>
                    <Th color="gray.300">Turf</Th>
                    <Th color="gray.300">Date</Th>
                    <Th color="gray.300">Time</Th>
                    <Th color="gray.300">Amount</Th>
                    <Th color="gray.300">Payment Status</Th>
                    <Th color="gray.300">Approval Status</Th>
                    <Th color="gray.300">Action</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {allBookings.length === 0 ? (
                    <Tr>
                      <Td colSpan={9} textAlign="center" color="gray.400" py={8}>
                        No bookings yet
                      </Td>
                    </Tr>
                  ) : (
                    allBookings.map((booking, idx) => (
                      <Tr key={idx} borderBottomColor="gray.600" _hover={{ bg: 'gray.700' }}>
                        <Td color="white">{booking.userName}</Td>
                        <Td color="gray.300" fontSize="sm">{booking.userEmail}</Td>
                        <Td color="white">{booking.turfName}</Td>
                        <Td color="gray.300">{booking.bookingDate}</Td>
                        <Td color="gray.300">{booking.time}</Td>
                        <Td color="green.300">₹{booking.amount}</Td>
                        <Td>
                          <Badge colorScheme={booking.paymentStatus === 'Confirmed' ? 'green' : 'yellow'}>
                            {booking.paymentStatus}
                          </Badge>
                        </Td>
                        <Td>
                          <Badge colorScheme={getStatusColor(booking.approvalStatus)}>
                            {booking.approvalStatus}
                          </Badge>
                        </Td>
                        <Td>
                          {booking.approvalStatus === 'Pending' ? (
                            <Button 
                              size="xs" 
                              colorScheme="blue" 
                              onClick={() => {
                                setSelectedBooking(booking);
                                onOpen();
                              }}
                            >
                              Review
                            </Button>
                          ) : (
                            <Text fontSize="xs" color="gray.400">
                              {booking.approvalStatus}
                            </Text>
                          )}
                        </Td>
                      </Tr>
                    ))
                  )}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Review Booking Modal */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered>
        <ModalOverlay />
        <ModalContent bg="gray.800">
          <ModalHeader color="white">Review Booking</ModalHeader>
          <ModalCloseButton color="white" />
          <ModalBody>
            {selectedBooking && (
              <Stack spacing={3}>
                <Box>
                  <Text color="gray.300" fontSize="sm">Customer Name</Text>
                  <Text color="white" fontWeight="bold">{selectedBooking.userName}</Text>
                </Box>
                <Box>
                  <Text color="gray.300" fontSize="sm">Email</Text>
                  <Text color="white">{selectedBooking.userEmail}</Text>
                </Box>
                <Box>
                  <Text color="gray.300" fontSize="sm">Turf Booked</Text>
                  <Text color="white" fontWeight="bold">{selectedBooking.turfName}</Text>
                </Box>
                <Box>
                  <Text color="gray.300" fontSize="sm">Date & Time</Text>
                  <Text color="white">{selectedBooking.bookingDate} at {selectedBooking.time}</Text>
                </Box>
                <Box>
                  <Text color="gray.300" fontSize="sm">Amount</Text>
                  <Text color="green.300" fontWeight="bold">₹{selectedBooking.amount}</Text>
                </Box>
                <Box>
                  <Text color="gray.300" fontSize="sm">Payment Status</Text>
                  <Badge colorScheme={selectedBooking.paymentStatus === 'Confirmed' ? 'green' : 'yellow'}>
                    {selectedBooking.paymentStatus}
                  </Badge>
                </Box>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter gap={2}>
            <Button colorScheme="red" onClick={() => {
              handleReject(selectedBooking);
            }}>
              Reject
            </Button>
            <Button colorScheme="green" onClick={() => {
              handleApprove(selectedBooking);
            }}>
              Approve
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default Admin;
