import { Official } from "../types";

export const mockOfficials: Official[] = [
  {
    id: "off-ward-1",
    name: "Thiru K. Balasubramanian",
    email: "aczone8@chennaicorporation.gov.in",
    mobileNumber: "+91 94451 90008",
    officeHours: "09:00 AM - 05:00 PM",
    ward: "Ward 104 - Anna Nagar (GCC Zone 8)",
    department: "Greater Chennai Corporation (GCC) - Water & Sanitation Dept",
    escalationOfficer: "Thiru Regional Deputy Commissioner (Central)",
    activeStatus: true
  },
  {
    id: "off-ward-2",
    name: "Thiru S. Palanisamy",
    email: "aczone13@chennaicorporation.gov.in",
    mobileNumber: "+91 94451 90013",
    officeHours: "09:30 AM - 05:30 PM",
    ward: "Ward 179 - Adyar / Thiruvanmiyur (GCC Zone 13)",
    department: "Greater Chennai Corporation (GCC) - Roads & Solid Waste Dept",
    escalationOfficer: "Thiru Regional Deputy Commissioner (South)",
    activeStatus: true
  },
  {
    id: "off-ward-3",
    name: "Thiru R. Soundararajan",
    email: "aczone9@chennaicorporation.gov.in",
    mobileNumber: "+91 94451 90009",
    officeHours: "09:00 AM - 05:00 PM",
    ward: "Ward 112 - Mylapore (GCC Zone 9)",
    department: "Greater Chennai Corporation (GCC) - Public Works & Sanitation",
    escalationOfficer: "Thiru Regional Deputy Commissioner (Central)",
    activeStatus: true
  },
  {
    id: "off-ward-4",
    name: "Thiru G. Saravanakumar",
    email: "commr.coimbatore@tn.gov.in",
    mobileNumber: "+91 94437 31102",
    officeHours: "10:00 AM - 05:30 PM",
    ward: "Ward 23 - RS Puram (Coimbatore Corporation West Zone)",
    department: "Coimbatore Municipal Corporation - Civil Works & Water Supply",
    escalationOfficer: "Commissioner, Coimbatore Municipal Corporation",
    activeStatus: true
  },
  {
    id: "off-ward-5",
    name: "Thiru P. Murugesan",
    email: "mducorp@gmail.com",
    mobileNumber: "+91 94431 46231",
    officeHours: "10:00 AM - 05:00 PM",
    ward: "Ward 45 - KK Nagar (Madurai Corporation Zone 3)",
    department: "Madurai Municipal Corporation - Streetlights & Sanitation",
    escalationOfficer: "Commissioner, Madurai Municipal Corporation",
    activeStatus: true
  },
  {
    id: "off-ward-6",
    name: "Thiru K. Kannan",
    email: "trichycorp@tn.gov.in",
    mobileNumber: "+91 94433 34418",
    officeHours: "09:00 AM - 05:00 PM",
    ward: "Ward 18 - Srirangam Zone (Trichy Corporation)",
    department: "Tiruchirappalli Corporation - Water Resource & Engineering",
    escalationOfficer: "Commissioner, Tiruchirappalli City Corporation",
    activeStatus: true
  }
];

export const wardLocations = [
  { ward: "Ward 104 - Anna Nagar (GCC Zone 8)", lat: 13.0850, lng: 80.2100, officialId: "off-ward-1" },
  { ward: "Ward 179 - Adyar / Thiruvanmiyur (GCC Zone 13)", lat: 12.9830, lng: 80.2590, officialId: "off-ward-2" },
  { ward: "Ward 112 - Mylapore (GCC Zone 9)", lat: 13.0400, lng: 80.2500, officialId: "off-ward-3" },
  { ward: "Ward 23 - RS Puram (Coimbatore Corporation West Zone)", lat: 11.0110, lng: 76.9480, officialId: "off-ward-4" },
  { ward: "Ward 45 - KK Nagar (Madurai Corporation Zone 3)", lat: 9.9280, lng: 78.1430, officialId: "off-ward-5" },
  { ward: "Ward 18 - Srirangam Zone (Trichy Corporation)", lat: 10.8620, lng: 78.6900, officialId: "off-ward-6" }
];

export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

export function matchWardByCoordinates(lat: number, lng: number): { ward: string; officialId: string } {
  let closestWard = wardLocations[0];
  let minDistance = Infinity;

  for (const loc of wardLocations) {
    const dist = getDistance(lat, lng, loc.lat, loc.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestWard = loc;
    }
  }

  // If closest pre-defined ward is further than 200 km, let's dynamically create a dynamic local ward
  // so that the user's actual location is used and displayed correctly, with no forced pinning.
  if (minDistance > 200000) {
    return {
      ward: `Local Zone (Lat: ${lat.toFixed(4)}° N, Lng: ${lng.toFixed(4)}° E)`,
      officialId: "off-dynamic-local"
    };
  }

  return {
    ward: closestWard.ward,
    officialId: closestWard.officialId
  };
}
