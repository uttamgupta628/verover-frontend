import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import {
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

import colors from "../../assets/color";

const FAQ = () => {
  const navigation = useNavigation();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  const faqs = [
    {
      question: "How do I book a parking slot?",
      answer:
        "Open the app, select 'Parking' from the home screen, and browse available parking slots near you. Choose your preferred slot, select your duration, and confirm your booking. You'll receive a QR code to access the parking spot.",
    },
    {
      question: "What is Residence Parking?",
      answer:
        "Residence Parking lets residents and homeowners list their private parking spaces for others to rent. You can book a verified residential parking spot on an hourly or daily basis — perfect for overnight stays or long-term needs.",
    },
    {
      question: "What is Garage Parking?",
      answer:
        "Garage Parking gives you access to secured, covered parking in registered garages. These are ideal for longer durations and offer added security for your vehicle. Browse garages by location, availability, and price.",
    },
    {
      question: "How does the Dry Cleaning service work?",
      answer:
        "Book a dry cleaning pickup from the app. A verified driver will come to your address and collect your clothes. Your garments are delivered to the dry cleaning merchant. Once cleaning is done, the merchant books a driver to deliver your clothes back to you — all trackable in real time.",
    },
    {
      question: "Can I track my dry cleaning order?",
      answer:
        "Yes! Every step of your dry cleaning order is fully trackable in the app. You can follow your clothes from pickup, to the merchant, and back to delivery — with live driver location and status updates at each stage.",
    },
    {
      question: "How do I cancel a booking?",
      answer:
        "Go to 'My Bookings' in the app, select the booking you want to cancel, and tap 'Cancel Booking'. Cancellation policies vary by service type and timing. Please review the cancellation terms shown during booking.",
    },
    {
      question: "Are the parking spots verified?",
      answer:
        "Yes. All parking slots — whether public lots, residential, or garages — are verified by our team before being listed on the platform. You can also view ratings and reviews from other users.",
    },
    {
      question: "How do I pay for my bookings?",
      answer:
        "Vervoer supports secure in-app payments. You can pay using your linked wallet, debit/credit card, or other available payment methods. All transactions are encrypted and receipts are stored in your booking history.",
    },
  ];

  const tips = [
    {
      icon: "car-multiple",
      title: "Parking Made Easy",
      description:
        "Find and book parking slots, residential spaces, and secured garages near you — all in one place. No more circling the block.",
    },
    {
      icon: "tshirt-crew",
      title: "Doorstep Dry Cleaning",
      description:
        "Schedule a pickup and a driver will collect your clothes, deliver them to the merchant, and bring them back clean — fully tracked from start to finish.",
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar
        hidden={false}
        barStyle="dark-content"
        animated
        backgroundColor="transparent"
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon source="arrow-left" size={35} color={colors.brandColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Help & FAQ</Text>
        </View>

        {/* Featured Tips */}
        {tips.map((tip, index) => (
          <View key={index} style={styles.tipContainer}>
            <View style={styles.tipIconRow}>
              <Icon source={tip.icon} size={26} color={colors.brandColor} />
              <Text style={styles.tipTitle}>{tip.title}</Text>
            </View>
            <Text style={styles.tipDescription}>{tip.description}</Text>
          </View>
        ))}

        {/* Guides */}
        <Text style={styles.sectionTitle}>Guides</Text>

        <View style={styles.guideContainer}>
          <Text style={styles.guideTitle}>Parking Guide</Text>
          <TouchableOpacity>
            <Text style={styles.linkText}>
              How to book a parking slot on Vervoer?
            </Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.linkText}>
              How does Residence & Garage Parking work?
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.guideContainer}>
          <Text style={styles.guideTitle}>Dry Cleaning Guide</Text>
          <TouchableOpacity>
            <Text style={styles.linkText}>
              How to schedule a dry cleaning pickup?
            </Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.linkText}>
              How to track my dry cleaning order?
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.guideContainer}>
          <Text style={styles.guideTitle}>Payments & Wallet</Text>
          <TouchableOpacity>
            <Text style={styles.linkText}>How to add money to my wallet?</Text>
          </TouchableOpacity>
          <TouchableOpacity>
            <Text style={styles.linkText}>How to view my booking receipts?</Text>
          </TouchableOpacity>
        </View>

        {/* FAQ */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

        {faqs.map((faq, index) => (
          <TouchableOpacity
            key={index}
            style={styles.faqContainer}
            onPress={() => toggleFAQ(index)}
            activeOpacity={0.8}
          >
            <View style={styles.faqHeader}>
              <Text style={styles.faqQuestion}>{faq.question}</Text>
              <Icon
                source={expandedFAQ === index ? "chevron-up" : "chevron-down"}
                size={24}
                color={colors.gray}
              />
            </View>

            {expandedFAQ === index && (
              <Text style={styles.faqAnswer}>{faq.answer}</Text>
            )}
          </TouchableOpacity>
        ))}

        {/* Report Issues */}
        <Text style={styles.sectionTitle}>Report an Issue</Text>

        <View style={styles.issueContainer}>
          <TouchableOpacity
            style={styles.issueCard}
            onPress={() => navigation.navigate("drawer/unsafe" as never)}
          >
            <Icon source="car-off" size={40} color={colors.brandColor} />
            <Text style={styles.issueText}>Parking Issue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.issueCard}
            onPress={() => navigation.navigate("drawer/unsafe" as never)}
          >
            <Icon source="hanger" size={40} color={colors.brandColor} />
            <Text style={styles.issueText}>Dry Cleaning Issue</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },
  content: {
    paddingBottom: responsiveHeight(5),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    width: responsiveWidth(55),
    justifyContent: "space-between",
    alignSelf: "flex-start",
    marginLeft: "5%",
    marginTop: responsiveHeight(1),
    marginBottom: responsiveHeight(1),
  },
  headerTitle: {
    fontSize: responsiveFontSize(2.5),
    color: colors.black,
  },
  tipContainer: {
    backgroundColor: "#FFFFFF",
    padding: responsiveWidth(5),
    borderRadius: 12,
    marginHorizontal: responsiveWidth(5),
    marginVertical: responsiveHeight(1),
  },
  tipIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: responsiveHeight(0.8),
  },
  tipTitle: {
    fontSize: responsiveFontSize(2),
    color: colors.black,
    fontWeight: "600",
    marginLeft: responsiveWidth(2),
  },
  tipDescription: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
    lineHeight: responsiveFontSize(3),
  },
  sectionTitle: {
    fontSize: responsiveFontSize(2.8),
    color: colors.black,
    marginHorizontal: responsiveWidth(5),
    marginTop: responsiveHeight(3),
    marginBottom: responsiveHeight(0.5),
  },
  guideContainer: {
    backgroundColor: "#FFFFFF",
    padding: responsiveWidth(4),
    borderRadius: 12,
    marginHorizontal: responsiveWidth(5),
    marginVertical: responsiveHeight(1),
    gap: responsiveHeight(0.8),
  },
  guideTitle: {
    fontSize: responsiveFontSize(1.9),
    color: colors.black,
    fontWeight: "600",
    marginBottom: responsiveHeight(0.3),
  },
  linkText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.brandColor,
  },
  faqContainer: {
    backgroundColor: "#FFFFFF",
    padding: responsiveWidth(4),
    borderRadius: 12,
    marginHorizontal: responsiveWidth(5),
    marginVertical: responsiveHeight(0.6),
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  faqQuestion: {
    fontSize: responsiveFontSize(1.9),
    color: colors.black,
    flex: 1,
    paddingRight: responsiveWidth(2),
  },
  faqAnswer: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray,
    marginTop: responsiveHeight(1),
    lineHeight: responsiveFontSize(3),
  },
  issueContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginTop: responsiveHeight(2),
    marginBottom: responsiveHeight(2),
  },
  issueCard: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    width: responsiveWidth(40),
    height: responsiveHeight(13),
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  issueText: {
    fontSize: responsiveFontSize(1.8),
    marginTop: responsiveHeight(1),
    textAlign: "center",
    color: colors.black,
  },
});

export default FAQ;