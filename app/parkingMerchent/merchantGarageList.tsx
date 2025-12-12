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

// Dummy Data matching the "My Garages" screenshot
const PARKING_DATA = [
	{
		id: "1",
		title: "RohanLot 2",
		address: "234, dkdr, dk in",
		price: "100.00",
		slots: "203",
		phone: "+9145304943983",
		status: "Limited Hours", // Logic for Red button
		logo: "https://cdn-icons-png.flaticon.com/512/896/896136.png", // Placeholder for Gold 'S' logo
		// Detail data
		email: "rohan@shineguru.com",
		latitude: "37.421998",
		longitude: "-122.084000",
		zones: [
			{ id: "z1", name: "Zone A", slots: "10", price: "1.00" },
			{ id: "z2", name: "Zone B", slots: "20", price: "1.00" },
		],
		description: "Exclusive parking for Shine Guru members.",
		images: [
			"https://images.unsplash.com/photo-1590674899505-1c5c41951f89?q=80&w=2070&auto=format&fit=crop",
		],
	},
	{
		id: "2",
		title: "RohanLot",
		address: "234, dkdr, dk in",
		price: "100.00",
		slots: "10",
		phone: "+9145304943983",
		status: "24/7 Open", // Logic for Green button
		logo: "https://cdn-icons-png.flaticon.com/512/896/896136.png",
		// Detail data
		email: "info@shineguru.com",
		latitude: "22.5726",
		longitude: "88.3639",
		zones: [{ id: "z1", name: "Zone A", slots: "5", price: "2.00" }],
		description: "Standard open parking lot.",
		images: [],
	},
];

const Header = ({ router }: any) => (
	<View style={styles.headerContainer}>
		<TouchableOpacity onPress={() => router.back()}>
			<ArrowLeft
				color="#F59E0B"
				size={28}
			/>
		</TouchableOpacity>
		<Text style={styles.headerTitle}>My Garages</Text>
		<TouchableOpacity onPress={() => router.push("/addGarage")}>
			<Plus
				color="#F59E0B"
				size={28}
			/>
		</TouchableOpacity>
	</View>
);

const GarageCard = ({ item, router }: any) => {
	const handlePress = () => {
		// Pass all item data to details page
		router.push({
			pathname: "/parkingDetails",
			params: {
				...item,
				zones: JSON.stringify(item.zones), // Serialize array for navigation
				images: JSON.stringify(item.images),
			},
		});
	};

	const isLimited = item.status === "Limited Hours";

	return (
		<TouchableOpacity
			activeOpacity={0.9}
			onPress={handlePress}
			style={styles.cardContainer}>
			{/* 1. Dark Blue Header with Logo */}
			<View style={styles.cardHeaderBackground}>
				<View style={styles.logoWrapper}>
					{/* Using a Tinted Image to simulate the Gold Logo */}
					<Image
						source={{ uri: item.logo }}
						style={styles.logoImage}
						resizeMode="contain"
					/>
					<Text style={styles.brandName}>SHINE Guru</Text>
				</View>
			</View>

			{/* 2. White Info Body */}
			<View style={styles.cardBody}>
				<Text style={styles.cardTitle}>{item.title}</Text>
				<Text style={styles.cardAddress}>{item.address}</Text>

				{/* Price and Slots */}
				<View style={styles.rowBetween}>
					<Text style={styles.label}>
						Price: <Text style={styles.priceText}>${item.price}/hr</Text>
					</Text>
					<Text style={styles.label}>
						Total Slots: <Text style={styles.slotsText}>{item.slots}</Text>
					</Text>
				</View>

				{/* Phone and Status Button */}
				<View style={[styles.rowBetween, { marginTop: 15 }]}>
					<View style={styles.phoneContainer}>
						<Phone
							color="#F59E0B"
							size={18}
						/>
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

export default function MyGaragesList() {
	const router = useRouter();
	return (
		<SafeAreaView style={styles.container}>
			<StatusBar
				barStyle="dark-content"
				backgroundColor="#fff"
			/>
			<Header router={router} />
			<FlatList
				data={PARKING_DATA}
				keyExtractor={(item) => item.id}
				renderItem={({ item }) => (
					<GarageCard
						item={item}
						router={router}
					/>
				)}
				contentContainerStyle={styles.listContent}
				showsVerticalScrollIndicator={false}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#F8F9FA" },
	// Header
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
	headerTitle: { fontSize: 20, fontWeight: "bold", color: "#000" },
	listContent: { padding: 16 },

	// Card Styles
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
	// Dark Blue Top Half
	cardHeaderBackground: {
		backgroundColor: "#050B20", // Deep Navy Blue
		height: 140,
		justifyContent: "center",
		alignItems: "center",
	},
	logoWrapper: { alignItems: "center" },
	logoImage: { width: 60, height: 60, tintColor: "#F59E0B" }, // Gold tint
	brandName: { color: "#F59E0B", fontSize: 14, marginTop: 5, letterSpacing: 1 },

	// White Bottom Half
	cardBody: { padding: 16, backgroundColor: "#fff" },
	cardTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#000",
		marginBottom: 4,
	},
	cardAddress: { fontSize: 14, color: "#888", marginBottom: 12 },

	rowBetween: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	label: { fontSize: 14, color: "#888" },
	priceText: { color: "#F59E0B", fontWeight: "bold" },
	slotsText: { color: "#000", fontWeight: "bold" },

	phoneContainer: { flexDirection: "row", alignItems: "center", gap: 6 },
	phoneNumber: { color: "#666", fontSize: 14 },

	statusButton: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20 },
	statusRed: { backgroundColor: "#FF4444" },
	statusGreen: { backgroundColor: "#4CAF50" },
	statusButtonText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
