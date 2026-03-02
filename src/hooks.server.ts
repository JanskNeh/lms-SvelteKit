// src/hooks.server.js
import { redirect } from '@sveltejs/kit';
import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private'; // Import dynamic env for Sovereign flexibility

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
    const { url, locals, request } = event;

    // Use the POCKETBASE_URL from Coolify, fallback to local for dev
    const pbUrl = process.env.POCKETBASE_URL || 'http://127.0.0.1:8090';
    locals.pb = new PocketBase(pbUrl);

    // load the store data from the request cookie string
    locals.pb.authStore.loadFromCookie(request.headers.get('cookie') || '');

    try {
        // get an up-to-date auth store state
        if (locals.pb.authStore.isValid) {
            await locals.pb.collection('users').authRefresh();
            locals.user = locals.pb.authStore.model;
        }
    } catch (_) {
        // clear the auth store on failed refresh
        locals.pb.authStore.clear();
        locals.user = undefined;
    }

    // Auth Guard logic
    if (
        url.pathname.startsWith('/') &&
        !locals.user &&
        !['/login', '/register'].includes(url.pathname)
    ) {
        throw redirect(303, '/login'); // SvelteKit 2 requires 'throw' for redirect
    }

    const response = await resolve(event);

    // send back the default 'pb_auth' cookie
    response.headers.append('set-cookie', locals.pb.authStore.exportToCookie());

    return response;
}