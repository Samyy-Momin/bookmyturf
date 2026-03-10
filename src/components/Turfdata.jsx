import React, { useEffect, useState } from "react";
import { db } from "../firebase-config/config";
import { collection, getDocs } from "firebase/firestore";
import { Loading } from "./Loading";
import { TimeSelectModal } from "./TimeSelectModal";

export const Turfdata = (prop) => {
  const { turf, city } = prop;
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [, setElement] = useState({})
  const [time,setTime] = useState("")
  const [turfName,setTurfName] = useState("")
  // const navigate = useNavigate()


  useEffect(() => {
    const SPORTS = ["cricket", "football", "basketball", "badminton"];
    setLoading(true);
    const getData = async () => {
      try {
        let allData = [];
        // Fetch all data for all sports if needed
        if (turf === "All") {
          for (const s of SPORTS) {
            const turfData = await getDocs(collection(db, s));
            allData = allData.concat(
              turfData.docs.map((doc) => ({ ...doc.data(), id: doc.id, sport: s }))
            );
          }
        } else {
          const turfData = await getDocs(collection(db, turf));
          allData = turfData.docs.map((doc) => ({ ...doc.data(), id: doc.id, sport: turf }));
        }

        let filterData = allData;
        // Filtering logic:
        // 1. If both are 'All', show everything (no filter)
        // 2. If city is specific and turf is 'All', show all sports for that city
        // 3. If turf is specific and city is 'All', show all locations for that sport
        // 4. If both are specific, show only that sport in that city

        if (city !== "All" && turf === "All") {
          // All sports, specific city
          filterData = allData.filter((d) => {
            if (d.city) return d.city === city;
            if (d.address) return d.address.toLowerCase().includes(city.toLowerCase());
            return false;
          });
        } else if (city === "All" && turf !== "All") {
          // Specific sport, all locations
          filterData = allData.filter((d) => {
            // Show all locations that have this sport
            return d.sport === turf;
          });
        } else if (city !== "All" && turf !== "All") {
          // Specific sport, specific city
          filterData = allData.filter((d) => {
            const matchCity = d.city ? d.city === city : (d.address && d.address.toLowerCase().includes(city.toLowerCase()));
            return matchCity && d.sport === turf;
          });
        }
        // else: both 'All', show everything

        setData(filterData);
        setLoading(false);
      } catch (err) {
        setError(err.message || "Failed to load turfs");
        setLoading(false);
      }
    };
    getData();
  }, [turf, city]);
  console.log(turfName);
  //  console.log(time,element)
   localStorage.setItem("time",time)

  if (loading) {
    return <div id="turfContainer">
         <Loading/>;
      </div>
  }
  if (error) {
    return (
      <div id="turfContainer">
        <p style={{color: 'red', textAlign: 'center'}}>{error}</p>
      </div>
    )
  }
 console.log(error);
  return (
    <div>
      <p className="heading-turf">Turf Available for {turf}</p>
      <div className="turf-container">
        {data.map((ele) => {
          return (
            <div className="turf-box" key={ele.id}>
              <div className="listing-img">
                <img src={ele.image} alt={ele.name} />
              </div>
              <div className="turf-card-body">
                <p className="turf-name">{ele.name}</p>
                <p className="turf-address">{ele.address}</p>
                <div className="turf-actions">
                  <TimeSelectModal turf={turf} element={ele} turfName={turfName} setTurfName={setTurfName} setElement={setElement} setTime={setTime} id={ele.id}/>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
