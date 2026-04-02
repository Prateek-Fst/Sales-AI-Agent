import { ObjectId } from 'mongodb'

// Types based on Prisma schema
export type Plan = 'STANDARD' | 'PRO' | 'ULTIMATE'
export type Role = 'user' | 'assistant'

export interface User {
  _id?: ObjectId
  id: string
  fullname: string
  email: string
  password: string
  type: string
  createdAt: Date
  updatedAt: Date
  stripeId?: string
}

export interface Domain {
  _id?: ObjectId
  id: string
  name: string
  icon: string
  userId?: string
  campaignId?: string
}

export interface ChatBot {
  _id?: ObjectId
  id: string
  welcomeMessage?: string
  icon?: string
  background?: string
  textColor?: string
  helpdesk: boolean
  domainId?: string
}

export interface Billings {
  _id?: ObjectId
  id: string
  plan: Plan
  credits: number
  userId?: string
}

export interface HelpDesk {
  _id?: ObjectId
  id: string
  question: string
  answer: string
  domainId?: string
}

export interface FilterQuestions {
  _id?: ObjectId
  id: string
  question: string
  answered?: string
  domainId?: string
}

export interface CustomerResponses {
  _id?: ObjectId
  id: string
  question: string
  answered?: string
  customerId: string
}

export interface Customer {
  _id?: ObjectId
  id: string
  email?: string
  domainId?: string
}

export interface ChatRoom {
  _id?: ObjectId
  id: string
  live: boolean
  mailed: boolean
  createdAt: Date
  updatedAt: Date
  customerId?: string
}

export interface ChatMessage {
  _id?: ObjectId
  id: string
  message: string
  role?: Role
  createdAt: Date
  updatedAt: Date
  chatRoomId?: string
  seen: boolean
}

export interface Bookings {
  _id?: ObjectId
  id: string
  date: Date
  slot: string
  email: string
  customerId?: string
  domainId?: string
  createdAt: Date
}

export interface Campaign {
  _id?: ObjectId
  id: string
  name: string
  customers: string[]
  template?: string
  userId?: string
  createdAt: Date
}

export interface Product {
  _id?: ObjectId
  id: string
  name: string
  price: number
  image: string
  createdAt: Date
  domainId?: string
}

// Collection names
export const collections = {
  users: 'users',
  domains: 'domains',
  chatBots: 'chatBots',
  billings: 'billings',
  helpDesks: 'helpDesks',
  filterQuestions: 'filterQuestions',
  customerResponses: 'customerResponses',
  customers: 'customers',
  chatRooms: 'chatRooms',
  chatMessages: 'chatMessages',
  bookings: 'bookings',
  campaigns: 'campaigns',
  products: 'products',
  blogPosts: 'blogPosts',
}

// Helper to generate UUID-like string
export function generateId(): string {
  return new ObjectId().toHexString()
}
