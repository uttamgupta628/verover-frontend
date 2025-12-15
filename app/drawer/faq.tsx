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
      question: "Plug and play networks?",
      answer:
        "Lorem Ipsum Dolor Sit Amet, Consetetur Sadipscing Elitr, Sed Diam Nonumy Eirmod Tempor Invidunt Ut Labore Et Dolore Magna Aliquyam Erat, Sed Diam Voluptua.",
    },
    {
      question: "Collaboratively Empowered Markets?",
      answer: "Lorem Ipsum Dolor Sit Amet, Consetetur Sadipscing Elitr.",
    },
    {
      question: "Visualize Customer Directed",
      answer: "Lorem Ipsum Dolor Sit Amet, Consetetur Sadipscing Elitr.",
    },
    {
      question: "Efficiently Unleash Cross-Media?",
      answer: "Lorem Ipsum Dolor Sit Amet, Consetetur Sadipscing Elitr.",
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
          <Text style={styles.headerTitle}>Featured Tips</Text>
        </View>

        {/* Featured Tips */}
        <View style={styles.tipContainer}>
          <Text style={styles.tipTitle}>
            Lorem ipsum dolor sit amet, consetetur
          </Text>
          <Text style={styles.tipDescription}>
            Lorem Ipsum Dolor Sit Amet, Consetetur Sadipscing Elitr, Sed Diam
            Nonumy Eirmod Tempor Invidunt Ut Labore Et Dolore Magna Aliquyam
            Erat, Sed Diam Voluptua.
          </Text>
        </View>

        <View style={styles.tipContainer}>
          <Text style={styles.tipTitle}>
            Lorem ipsum dolor sit amet, consetetur
          </Text>
          <Text style={styles.tipDescription}>
            Lorem Ipsum Dolor Sit Amet, Consetetur Sadipscing Elitr.
          </Text>
        </View>

        {/* Guides */}
        <Text style={styles.sectionTitle}>Guides</Text>

        <View style={styles.guideContainer}>
          <Text style={styles.guideTitle}>Beginner’s Guide</Text>
          <TouchableOpacity>
            <Text style={styles.linkText}>How to use Vervoer Website?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.guideContainer}>
          <Text style={styles.guideTitle}>Android App Guide</Text>
          <TouchableOpacity>
            <Text style={styles.linkText}>How to use Vervoer Android App?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.guideContainer}>
          <Text style={styles.guideTitle}>iOS App Guide</Text>
          <TouchableOpacity>
            <Text style={styles.linkText}>How to use Vervoer iOS App?</Text>
          </TouchableOpacity>
        </View>

        {/* FAQ */}
        <Text style={styles.sectionTitle}>FAQ</Text>

        {faqs.map((faq, index) => (
          <TouchableOpacity
            key={index}
            style={styles.faqContainer}
            onPress={() => toggleFAQ(index)}
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

        {/* Unsafe Stations */}
        <Text style={styles.sectionTitle}>
          Issue Related Unsafe Bus & Train Stations?
        </Text>

        <View style={styles.issueContainer}>
          <TouchableOpacity
            style={styles.issueCard}
            onPress={() => navigation.navigate("drawer/unsafe")}
          >
            <Icon source="bus-alert" size={40} color={colors.brandColor} />
            <Text style={styles.issueText}>Unsafe Train Stops</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.issueCard}
            onPress={() => navigation.navigate("drawer/unsafe")}
          >
            <Icon source="bus-stop" size={40} color={colors.brandColor} />
            <Text style={styles.issueText}>Unsafe Bus Stops</Text>
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
    width: responsiveWidth(45),
    justifyContent: "space-between",
    marginTop: "0%",
    alignSelf: "flex-start",
    marginLeft: "5%",
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
  tipTitle: {
    fontSize: responsiveFontSize(2),
    color: colors.black,
  },
  tipDescription: {
    fontSize: responsiveFontSize(1.8),
    color: colors.gray,
    marginTop: responsiveHeight(1),
  },
  sectionTitle: {
    fontSize: responsiveFontSize(2.8),
    color: colors.black,
    marginHorizontal: responsiveWidth(5),
    marginTop: responsiveHeight(3),
  },
  guideContainer: {
    backgroundColor: "#FFFFFF",
    padding: responsiveWidth(4),
    borderRadius: 12,
    marginHorizontal: responsiveWidth(5),
    marginVertical: responsiveHeight(1),
  },
  guideTitle: {
    fontSize: responsiveFontSize(1.8),
    color: colors.black,
  },
  linkText: {
    fontSize: responsiveFontSize(1.8),
    color: colors.brandColor,
    marginTop: responsiveHeight(0.5),
  },
  faqContainer: {
    backgroundColor: "#FFFFFF",
    padding: responsiveWidth(4),
    borderRadius: 12,
    marginHorizontal: responsiveWidth(5),
    marginVertical: responsiveHeight(1),
  },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  faqQuestion: {
    fontSize: responsiveFontSize(2),
    color: colors.black,
  },
  faqAnswer: {
    fontSize: responsiveFontSize(1.7),
    color: colors.gray,
    marginTop: responsiveHeight(1),
  },
  issueContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginTop: responsiveHeight(5),
  },
  issueCard: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    width: responsiveWidth(45),
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
  },
});

export default FAQ;
