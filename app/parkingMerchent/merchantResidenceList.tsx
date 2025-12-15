import React from "react";
import {
	View,
	Text,
	Image,
	FlatList,
	StyleSheet,
	StatusBar,
	TouchableOpacity,
} from "react-native";
import { ArrowLeft, Plus, Phone } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

// Dummy Data for Residential Parking
const RESIDENCE_DATA = [
	{
		id: "1",
		title: "Green Valley Apartments",
		address: "123 Park Avenue, Downtown",
		price: "50.00",
		slots: "45",
		phone: "+9145304943983",
		status: "24/7 Open",
		logo: "https://cdn-icons-png.flaticon.com/512/3097/3097170.png",
		email: "greenvalley@residential.com",
		latitude: "37.421998",
		longitude: "-122.084000",
		zones: [
			{ id: "z1", name: "Building A", slots: "20", price: "50.00" },
			{ id: "z2", name: "Building B", slots: "25", price: "50.00" },
		],
		description: "Secure residential parking for Green Valley Apartments residents. 24/7 access with electronic gates.",
		images: [
			"https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?q=80&w=2070&auto=format&fit=crop",
		],
	},
	{
		id: "2",
		title: "Sunset Heights",
		address: "456 Oak Street, West Side",
		price: "60.00",
		slots: "30",
		phone: "+9145304943984",
		status: "Limited Hours",
		logo: "https://cdn-icons-png.flaticon.com/512/3097/3097170.png",
		email: "sunset@residential.com",
		latitude: "37.422998",
		longitude: "-122.085000",
		zones: [
			{ id: "z1", name: "Tower 1", slots: "15", price: "60.00" },
			{ id: "z2", name: "Tower 2", slots: "15", price: "60.00" },
		],
		description: "Residential parking with covered spaces. Access hours: 6 AM - 10 PM.",
		images: [
			"https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop",
		],
	},
	{
		id: "3",
		title: "Riverside Complex",
		address: "789 River Road, East End",
		price: "45.00",
		slots: "60",
		phone: "+9145304943985",
		status: "24/7 Open",
		logo: "https://cdn-icons-png.flaticon.com/512/3097/3097170.png",
		email: "riverside@residential.com",
		latitude: "37.423998",
		longitude: "-122.086000",
		zones: [
			{ id: "z1", name: "Block A", slots: "30", price: "45.00" },
			{ id: "z2", name: "Block B", slots: "30", price: "45.00" },
		],
		description: "Large residential parking facility with ample space for residents and guests.",
		images: [],
	},
];

const Header = ({ router }: any) => (
	<View style={styles.headerContainer}>
		<TouchableOpacity onPress={() => router.back()}>
			<ArrowLeft color="#F59E0B" size={28} />
		</TouchableOpacity>
		<Text style={styles.headerTitle}>My Residences</Text>
		<TouchableOpacity onPress={() => router.push("/parkingMerchent/registerResidence")}>
			<Plus color="#F59E0B" size={28} />
		</TouchableOpacity>
	</View>
);

const ResidenceCard = ({ item, router }: any) => {
	const handlePress = () => {
		router.push({
			pathname: "/parkingMerchent/merchantResidenceDetails",
			params: {
				id: item.id,
				title: item.title,
				address: item.address,
				location: item.address,
				price: item.price,
				slots: item.slots,
				phone: item.phone,
				status: item.status,
				logo: item.logo,
				email: item.email,
				latitude: item.latitude,
				longitude: item.longitude,
				description: item.description,
				zones: JSON.stringify(item.zones),
				images: JSON.stringify(item.images.length > 0 ? item.images : [item.logo]),
			},
		});
	};

	const isLimited = item.status === "Limited Hours";

	return (
		<TouchableOpacity
			activeOpacity={0.9}
			onPress={handlePress}
			style={styles.cardContainer}>
			{/* Dark Blue Header with Logo */}
			<View style={styles.cardHeaderBackground}>
				<View style={styles.logoWrapper}>
					<Image
						source={{ uri: item.logo }}
						style={styles.logoImage}
						resizeMode="contain"
					/>
					<Text style={styles.brandName}>RESIDENTIAL</Text>
				</View>
			</View>

			{/* White Info Body */}
			<View style={styles.cardBody}>
				<Text style={styles.cardTitle}>{item.title}</Text>
				<Text style={styles.cardAddress}>{item.address}</Text>

				{/* Price and Slots */}
				<View style={styles.rowBetween}>
					<Text style={styles.label}>
						Price: <Text style={styles.priceText}>${item.price}/month</Text>
					</Text>
					<Text style={styles.label}>
						Total Slots: <Text style={styles.slotsText}>{item.slots}</Text>
					</Text>
				</View>

				{/* Phone and Status Button */}
				<View style={[styles.rowBetween, { marginTop: 15 }]}>
					<View style={styles.phoneContainer}>
						<Phone color="#F59E0B" size={18} />
						<Text style={styles.phoneNumber}>{item.phone}</Text>
					</View>

					<View
						style={[
							styles.statusButton,
							isLimited ? styles.statusRed : styles.statusGreen,
						]}>
						<Text style={styles.statusButtonText}>{item.status}</Text>
					</View>
				</View>
			</View>
		</TouchableOpacity>
	);
};

export default function MyResidencesList() {
	const router = useRouter();
	
	return (
		<SafeAreaView style={styles.container}>
			<StatusBar barStyle="dark-content" backgroundColor="#fff" />
			<Header router={router} />
			<FlatList
				data={RESIDENCE_DATA}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<ResidenceCard item={item} router={router} />
				)}
				contentContainerStyle={styles.listContent}
				showsVerticalScrollIndicator={false}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { 
		flex: 1, 
		backgroundColor: "#F8F9FA" 
	},
	headerContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 20,
		paddingVertical: 15,
		backgroundColor: "#fff",
		borderBottomWidth: 1,
		borderBottomColor: "#eee",
	},
	headerTitle: { 
		fontSize: 20, 
		fontWeight: "bold", 
		color: "#000" 
	},
	listContent: { 
		padding: 16 
	},
	cardContainer: {
		borderRadius: 16,
		marginBottom: 20,
		overflow: "hidden",
		backgroundColor: "#fff",
		elevation: 4,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
	},
	cardHeaderBackground: {
		backgroundColor: "#050B20",
		height: 140,
		justifyContent: "center",
		alignItems: "center",
	},
	logoWrapper: { 
		alignItems: "center" 
	},
	logoImage: { 
		width: 60, 
		height: 60, 
		tintColor: "#F59E0B" 
	},
	brandName: { 
		color: "#F59E0B", 
		fontSize: 14, 
		marginTop: 5, 
		letterSpacing: 1 
	},
	cardBody: { 
		padding: 16, 
		backgroundColor: "#fff" 
	},
	cardTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#000",
		marginBottom: 4,
	},
	cardAddress: { 
		fontSize: 14, 
		color: "#888", 
		marginBottom: 12 
	},
	rowBetween: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	label: { 
		fontSize: 14, 
		color: "#888" 
	},
	priceText: { 
		color: "#F59E0B", 
		fontWeight: "bold" 
	},
	slotsText: { 
		color: "#000", 
		fontWeight: "bold" 
	},
	phoneContainer: { 
		flexDirection: "row", 
		alignItems: "center", 
		gap: 6 
	},
	phoneNumber: { 
		color: "#666", 
		fontSize: 14 
	},
	statusButton: { 
		paddingVertical: 6, 
		paddingHorizontal: 16, 
		borderRadius: 20 
	},
	statusRed: { 
		backgroundColor: "#FF4444" 
	},
	statusGreen: { 
		backgroundColor: "#4CAF50" 
	},
	statusButtonText: { 
		color: "#fff", 
		fontSize: 12, 
		fontWeight: "600" 
	},
});