import Stripe from 'stripe'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
})

async function setupStripeProducts() {
  console.log('🚀 Setting up Stripe products and prices...\n')

  try {
    // Create Starter Plan
    console.log('Creating Starter plan...')
    const starterProduct = await stripe.products.create({
      name: 'TalentForge Starter',
      description: 'Perfect for small teams getting started with AI-powered recruiting',
      metadata: {
        tier: 'starter',
      },
    })

    const starterPrice = await stripe.prices.create({
      product: starterProduct.id,
      unit_amount: 4900, // $49.00
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        tier: 'starter',
      },
    })

    console.log(`✅ Starter: ${starterPrice.id}\n`)

    // Create Professional Plan
    console.log('Creating Professional plan...')
    const professionalProduct = await stripe.products.create({
      name: 'TalentForge Professional',
      description: 'Advanced features for growing recruitment teams',
      metadata: {
        tier: 'professional',
      },
    })

    const professionalPrice = await stripe.prices.create({
      product: professionalProduct.id,
      unit_amount: 14900, // $149.00
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        tier: 'professional',
      },
    })

    console.log(`✅ Professional: ${professionalPrice.id}\n`)

    // Create Enterprise Plan
    console.log('Creating Enterprise plan...')
    const enterpriseProduct = await stripe.products.create({
      name: 'TalentForge Enterprise',
      description: 'Full-featured solution for enterprise recruitment needs',
      metadata: {
        tier: 'enterprise',
      },
    })

    const enterprisePrice = await stripe.prices.create({
      product: enterpriseProduct.id,
      unit_amount: 49900, // $499.00
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        tier: 'enterprise',
      },
    })

    console.log(`✅ Enterprise: ${enterprisePrice.id}\n`)

    // Print summary
    console.log('═══════════════════════════════════════════════════')
    console.log('✨ Stripe products created successfully!')
    console.log('═══════════════════════════════════════════════════\n')
    console.log('Add these to your .env.local file:\n')
    console.log(`STRIPE_STARTER_PRICE_ID=${starterPrice.id}`)
    console.log(`STRIPE_PROFESSIONAL_PRICE_ID=${professionalPrice.id}`)
    console.log(`STRIPE_ENTERPRISE_PRICE_ID=${enterprisePrice.id}`)
    console.log('\n═══════════════════════════════════════════════════')

    return {
      starter: starterPrice.id,
      professional: professionalPrice.id,
      enterprise: enterprisePrice.id,
    }
  } catch (error) {
    console.error('❌ Error setting up Stripe products:', error)
    throw error
  }
}

setupStripeProducts()
  .then(() => {
    console.log('\n✅ Setup complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Setup failed:', error)
    process.exit(1)
  })
