import {
  clerkMiddleware,
  createRouteMatcher,
  //   auth,
} from '@clerk/nextjs/server';
import { NextResponse } from 'next/server'; // Import NextResponse
import { prisma } from '@/lib/db'; // Adjust the path as needed
import { clerkClient } from '@clerk/clerk-sdk-node'; // Import the Clerk client to fetch user data

const isPublicRoute = createRouteMatcher(['/sign-in(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) {
    return NextResponse.next(); // Allow public routes to proceed without authentication
  }

  const session = await auth();

  if (!session?.sessionId) {
    return NextResponse.redirect(new URL('/sign-in', req.url)); // Redirect to sign-in if not authenticated
  }

  try {
    // Fetch user data from Clerk's API
    const clerkId = session.userId;
    const clerkUser = await clerkClient.users.getUser(clerkId);

    // Use Prisma's upsert within a transaction to update/create the user
    await prisma.$transaction(async (tx) => {
      await tx.user.upsert({
        where: { clerkId: clerkId },
        update: {
          name: clerkUser.firstName + ' ' + clerkUser.lastName, // Adjust as needed
          email: clerkUser.emailAddresses[0].emailAddress, // Adjust as needed
        },
        create: {
          clerkId: clerkId,
          name: clerkUser.firstName + ' ' + clerkUser.lastName, // Adjust as needed
          email: clerkUser.emailAddresses[0].emailAddress, // Adjust as needed
        },
      });
    });

    // Continue to the next middleware/route handler
    return NextResponse.next();
  } catch (error) {
    console.error('Error in authMiddleware:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
