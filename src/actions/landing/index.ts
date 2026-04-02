'use server'

import { connectToDatabase } from '@/lib/mongodb'
import { collections, generateId } from '@/lib/models'

export const onGetBlogPost = async (id: string) => {
  try {
    const { db } = await connectToDatabase()
    const post = await db.collection(collections.blogPosts).findOne({ id })
    if (post) {
      return {
        title: post.title as string,
        content: post.content as string,
        createdAt: new Date(post.createdAt),
      }
    }
    return null
  } catch (error) {
    console.log(error)
    return null
  }
}
