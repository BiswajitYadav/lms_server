import { Webhook } from "svix";
import User from "../models/User.js";
import stripe from "stripe";
import { Purchase } from "../models/Purchase.js";
import Course from "../models/Course.js";



// API Controller Function to Manage Clerk User with database

export const clerkWebhooks = async (req, res) => {

  try {

    const whook = new Webhook(process.env.CLERK_WEBHOOK_SECRET);

    const headers = {
      "svix-id": req.headers["svix-id"],
      "svix-timestamp": req.headers["svix-timestamp"],
      "svix-signature": req.headers["svix-signature"],
    };

    // ✅ Verify with raw body (Buffer)
    const evt = await whook.verify(req.body, headers);

    const { data, type } = evt;

    console.log("✅ Clerk event:", type);

    switch (type) {

      case "user.created": {
        await User.create({
          _id: data.id,
          email: data.email_addresses[0].email_address,
          name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
          imageUrl: data.image_url,
          resume: "",
        });
        break;
      }

      case "user.updated": {
        await User.findByIdAndUpdate(data.id, {
          email: data.email_addresses[0].email_address,
          name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
          imageUrl: data.image_url,
        });
        break;
      }

      case "user.deleted": {
        await User.findByIdAndDelete(data.id);
        break;
      }

      default:
        console.log("⚠️ Unhandled event:", type);
        break;
    }

    res.json({ received: true });

  } catch (error) {

    console.error("❌ Clerk webhook error:", error);
    res.status(400).json({ success: false, message: error.message });

  }

};

// Stripe Gateway Initialize


// Stripe Webhooks to Manage Payments Action
export const stripeWebhooks = async (request, response) => {

  const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);

  const sig = request.headers['stripe-signature'];

  console.log("✅ Stripe webhook endpoint hit");

  let event;

  try {
    event = stripeInstance.webhooks.constructEvent(
      request.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log(err)
    console.error("❌ Stripe signature verification failed:", err.message);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 🔹 Safety check
  if (!event || !event.type) {
    console.error("❌ Invalid or undefined Stripe event object");
    return response.status(400).json({ success: false, message: "Invalid Stripe event" });
  }

  console.log("🎯 Stripe Event Type:", event.type);

  // Handle the event
  switch (event.type) {
    case "payment_intent.succeeded": {
      console.log("✅ Payment Success Webhook Triggered");

      const paymentIntent = event.data.object;
      const paymentIntentId = paymentIntent.id;

      // 🔍 Get Checkout Session
      const sessionList = await stripeInstance.checkout.sessions.list({
        payment_intent: paymentIntentId,
      });

      if (!sessionList.data.length) {
        console.error("❌ No session found for this payment intent");
        return response.json({ received: true });
      }

      const { purchaseId } = sessionList.data[0].metadata;
      const purchaseData = await Purchase.findById(purchaseId);
      if (!purchaseData) {
        console.error("❌ Purchase record not found");
        return response.json({ received: true });
      }

      const userData = await User.findById(purchaseData.userId);
      const courseData = await Course.findById(purchaseData.courseId.toString());

      if (userData && courseData) {
        courseData.enrolledStudents.push(userData._id);
        await courseData.save();

        userData.enrolledCourses.push(courseData._id);
        await userData.save();
      }

      purchaseData.status = "completed";
      await purchaseData.save();

      break;
    }

    case "payment_intent.payment_failed": {
      console.log("❌ Payment Failed Webhook Triggered");

      const paymentIntent = event.data.object;
      const paymentIntentId = paymentIntent.id;

      const sessionList = await stripeInstance.checkout.sessions.list({
        payment_intent: paymentIntentId,
      });

      if (sessionList.data.length) {
        const { purchaseId } = sessionList.data[0].metadata;
        const purchaseData = await Purchase.findById(purchaseId);
        if (purchaseData) {
          purchaseData.status = "failed";
          await purchaseData.save();
        }
      }

      break;
    }

    default:
      console.log(`⚠️ Unhandled event type ${event.type}`);
  }

  response.json({ received: true });
};