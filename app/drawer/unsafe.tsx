import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
  Image,
  Linking,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-paper/src/components/Icon";
import {
  responsiveFontSize,
  responsiveHeight,
  responsiveWidth,
} from "react-native-responsive-dimensions";
import { useSelector } from "react-redux";

import colors from "../../assets/color";
import { images } from "../../assets/images/images";
import { RootState } from "../../components/redux/store";

const unsafe = () => {
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);

  // ✅ Unsafe Stops from Redux
  const unsafeStops = useSelector(
    (state: RootState) => state.unsafeStops.unsafeStops
  );

  const supportCenters = [
    { id: 1, name: "Support Centre 1", phone: "+1 1048285215" },
    { id: 2, name: "Support Centre 2", phone: "+1 1048285215" },
    { id: 3, name: "Support Centre 3", phone: "+1 1048285215" },
  ];

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  return (
    <View style={styles.container}>
      <StatusBar
        hidden={false}
        barStyle="dark-content"
        animated
        backgroundColor="transparent"
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={35} color={colors.brandColor} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Unsafe Stops</Text>
      </View>

      {/* Mark Unsafe */}
      <TouchableOpacity
        style={styles.markButton}
        onPress={() => navigation.navigate("drawer/markNew")}
      >
        <Text style={styles.markButtonText}>+ Mark New Station as Unsafe</Text>
      </TouchableOpacity>

      {/* Contact Button */}
      <TouchableOpacity
        style={styles.contactButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.contactButtonText}>Contact Public Metro</Text>
      </TouchableOpacity>

      <ScrollView>
        {/* Map */}
        <View style={styles.mapContainer}>
          <Image source={images.BGmap} style={styles.map} />

          {/* Static Markers */}
          <View style={[styles.marker, { top: "20%", left: "30%" }]}>
            <Icon source="alert-circle" size={30} color="red" />
          </View>
          <View style={[styles.marker, { top: "50%", left: "60%" }]}>
            <Icon source="alert-circle" size={30} color="red" />
          </View>
          <View style={[styles.marker, { top: "75%", left: "40%" }]}>
            <Icon source="alert-circle" size={30} color="red" />
          </View>
        </View>

        {/* Unsafe Stops List */}
        <ScrollView style={styles.bottomSheet}>
          {unsafeStops.length === 0 ? (
            <Text style={styles.noStopsText}>No Unsafe Stops Reported</Text>
          ) : (
            unsafeStops.map((stop, index) => (
              <View key={index} style={styles.card}>
                <Text style={styles.cardTitle}>{stop.title}</Text>
                <Text style={styles.cardTime}>⏳ {stop.time}</Text>
                <Text style={styles.cardDescription}>• {stop.description}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </ScrollView>

      {/* Contact Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Contact Public Metro</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon source="close" size={25} color={colors.black} />
              </TouchableOpacity>
            </View>

            {supportCenters.map((center) => (
              <View key={center.id} style={styles.supportCard}>
                <View style={styles.supportTextContainer}>
                  <Text style={styles.supportTitle}>{center.name}</Text>
                  <Text style={styles.supportPhone}>📞 {center.phone}</Text>
                </View>
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => handleCall(center.phone)}
                >
                  <Text style={styles.callButtonText}>Call</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFAFA" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    width: responsiveWidth(45),
    justifyContent: "space-between",
    marginTop: "0%",
    position: "absolute",
    zIndex: 2,
    marginLeft: "5%",
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5),
    color: colors.black,
  },

  mapContainer: {
    width: "100%",
    height: responsiveHeight(50),
  },
  map: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  marker: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 20,
    padding: 5,
  },

  bottomSheet: { marginTop: responsiveHeight(2) },

  noStopsText: {
    fontSize: responsiveFontSize(2),
    textAlign: "center",
    marginVertical: 20,
    color: colors.gray,
  },

  card: {
    backgroundColor: "#FFFFFF",
    padding: responsiveWidth(5),
    borderRadius: 12,
    marginHorizontal: responsiveWidth(5),
    marginVertical: responsiveHeight(1),
  },
  cardTitle: {
    fontSize: responsiveFontSize(2),
    fontWeight: "bold",
    color: colors.black,
  },
  cardTime: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
    marginVertical: responsiveHeight(0.5),
  },
  cardDescription: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray,
  },

  markButton: {
    backgroundColor: colors.brandColor,
    paddingVertical: responsiveHeight(2),
    borderRadius: 30,
    alignItems: "center",
    position: "absolute",
    bottom: responsiveHeight(13),
    width: responsiveWidth(70),
    alignSelf: "center",
    zIndex: 2,
  },
  markButtonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(2),
    fontWeight: "bold",
  },

  contactButton: {
    backgroundColor: "#5E5E5E",
    paddingVertical: responsiveHeight(2),
    borderRadius: 30,
    alignItems: "center",
    position: "absolute",
    bottom: responsiveHeight(5),
    width: responsiveWidth(70),
    alignSelf: "center",
    zIndex: 2,
  },
  contactButtonText: {
    color: "#FFF",
    fontSize: responsiveFontSize(2),
    fontWeight: "bold",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "white",
    width: responsiveWidth(85),
    padding: 20,
    borderRadius: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: responsiveFontSize(2.5),
    fontWeight: "bold",
    color: colors.brandColor,
  },

  supportCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
    marginTop: 10,
    backgroundColor: colors.lightGray,
    borderRadius: 8,
  },
  supportTextContainer: { flex: 1 },
  supportTitle: {
    fontSize: responsiveFontSize(2),
    fontWeight: "bold",
  },
  supportPhone: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
  },
  callButton: {
    backgroundColor: colors.brandColor,
    padding: 10,
    borderRadius: 5,
  },
  callButtonText: {
    color: "white",
    fontWeight: "bold",
  },
});

export default unsafe;
