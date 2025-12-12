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

// Dummy Data
const PARKING_DATA = [
	{
		id: "1",
		title: "Parking",
		location: "Asam, India",
		address: "Guwahati, Asam, India", // Added specific address for details
		price: "$1.00",
		slots: "30",
		phone: "6291015951",
		isOpen: true,
		description:
			"Residential parking refers to parking spaces designated for residents of a specific area, often involving permits or reserved spots to ensure availability near their homes.",
		// Mocking multiple images for the slider functionality
		images: [
			"https://images.unsplash.com/photo-1617788138017-80ad40651399?q=80&w=2070&auto=format&fit=crop",
			"https://images.unsplash.com/photo-1494976388531-d1058494cdd8?q=80&w=2070&auto=format&fit=crop",
			"https://images.unsplash.com/photo-1503376763036-066120622c74?q=80&w=2070&auto=format&fit=crop",
		],
	},
	{
		id: "2",
		title: "Uttam",
		location: "Kolkata",
		address: "Salt Lake, Kolkata",
		price: "$10.00",
		slots: "25",
		phone: "7602358552",
		isOpen: true,
		description: "Secure underground parking available 24/7.",
		images: [], // Empty to test fallback
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
		<Text style={styles.headerTitle}>My Parking Lots</Text>
		<TouchableOpacity
			onPress={() => router.push("/parkingMerchent/registerParkingLot")}>
			<Plus
				color="#F59E0B"
				size={28}
			/>
		</TouchableOpacity>
	</View>
);

const ParkingCard = ({ item, router }: any) => {
	// Navigate to details page passing the item object
	const handlePress = () => {
		router.push({
			pathname: "/parkingMerchent/merchantParkingDetails", // Ensure this matches your file name
			params: {
				...item,
				// We need to stringify arrays for params usually, or rely on expo-router to handle it
				images: JSON.stringify(item.images),
			},
		});
	};

	const displayImage =
		item.images && item.images.length > 0 ? item.images[0] : null;

	return (
		<TouchableOpacity
			activeOpacity={0.9}
			onPress={handlePress}
			style={styles.cardContainer}>
			{/* Image Section */}
			<View style={styles.imageContainer}>
				{displayImage ? (
					<Image
						source={{ uri: displayImage }}
						style={styles.cardImage}
						resizeMode="cover"
					/>
				) : (
					<View
						style={[
							styles.cardImage,
							{
								backgroundColor: "#E0E0E0",
								justifyContent: "center",
								alignItems: "center",
							},
						]}>
						<Text style={{ color: "#888" }}>No Image</Text>
					</View>
				)}
			</View>

			{/* Content Section */}
			<View style={styles.cardContent}>
				<Text style={styles.cardTitle}>{item.title}</Text>
				<Text style={styles.cardLocation}>{item.location}</Text>

				{/* Price and Slots Row */}
				<View style={styles.infoRow}>
					<Text style={styles.infoLabel}>
						Price: <Text style={styles.priceValue}>{item.price}/hr</Text>
					</Text>

					<Text style={styles.infoLabel}>
						Total Slots: <Text style={styles.slotsValue}>{item.slots}</Text>
					</Text>
				</View>

				{/* Phone and Status Row */}
				<View style={[styles.infoRow, { marginTop: 15 }]}>
					<View style={styles.phoneContainer}>
						<Phone
							color="#F59E0B"
							size={18}
							fill="#F59E0B"
						/>
						<Text style={styles.phoneNumber}>{item.phone}</Text>
					</View>

					<View style={styles.statusBadge}>
						<Text style={styles.statusText}>24/7 Open</Text>
					</View>
				</View>
			</View>
		</TouchableOpacity>
	);
};

export default function ParkingList() {
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
					<ParkingCard
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
	cardContainer: {
		backgroundColor: "#fff",
		borderRadius: 12,
		marginBottom: 20,
		overflow: "hidden",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 4,
		elevation: 4,
	},
	imageContainer: { height: 180, width: "100%" },
	cardImage: { width: "100%", height: "100%" },
	cardContent: { padding: 16 },
	cardTitle: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#000",
		marginBottom: 4,
	},
	cardLocation: { fontSize: 14, color: "#888", marginBottom: 12 },
	infoRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	infoLabel: { fontSize: 14, color: "#888" },
	priceValue: { color: "#F59E0B", fontWeight: "bold" },
	slotsValue: { color: "#000", fontWeight: "bold" },
	phoneContainer: { flexDirection: "row", alignItems: "center", gap: 8 },
	phoneNumber: { color: "#666", fontSize: 14, marginLeft: 5 },
	statusBadge: {
		backgroundColor: "#4CAF50",
		paddingVertical: 6,
		paddingHorizontal: 16,
		borderRadius: 20,
	},
	statusText: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
