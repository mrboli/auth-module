import Cookie from 'cookie'
import Cookies from 'js-cookie'
import 'whatwg-fetch'

export default {
  namespaced: true,

  state: () => ({
    token: null,
    user: null
  }),

  getters: {
    loggedIn (state) {
      return Boolean(state.user || state.token)
    }
  },

  mutations: {
    // SET_USER
    SET_USER (state, user) {
      state.user = user
    },

    // SET_TOKEN
    SET_TOKEN (state, token) {
      state.token = token
    }
  },

  actions: {
    updateToken ({ commit }, token) {
      // Update state
      commit('SET_TOKEN', token)

      // Update localStorage
      if (process.browser && localStorage) {
        if (token) {
          localStorage.setItem('nuxt::auth::token', token)
        } else {
          localStorage.removeItem('nuxt::auth::token')
        }
      }

      // Update cookies
      if (process.browser) {
        // ...Browser
        if (token) {
          Cookies.set('token', token)
        } else {
          Cookies.remove('token')
        }
      } else {
        // ...Server
        // TODO: Use set-cookie header for this.$ctx.res
      }
    },

    fetchToken ({ dispatch }) {
      let token

      // First try localStorage
      if (process.browser && localStorage) {
        token = localStorage.getItem('nuxt::auth::token')
      }

      // Then try to extract token from cookies
      if (!token) {
        const cookieStr = process.browser ? document.cookie : this.$ctx.req.headers.cookie
        const cookies = Cookie.parse(cookieStr || '') || {}
        token = cookies.access_token
        console.log('cookies:', cookies, 'token:', token)
      }

      if (token) {
        dispatch('updateToken', token)
      }
    },

    async invalidate ({ dispatch, commit }) {
      commit('SET_USER', null)
      await dispatch('updateToken', null)
    },

    async fetch ({ state, commit, dispatch }, { endpoint = 'auth/user', user } = {}) {
      // Fetch and update latest token
      await dispatch('fetchToken')

      // Not loggedIn
      if (!state.token) {
        return
      }

      if (user) {
        commit('SET_USER', user)
      } else {
        // Try to get user profile
        try {
          const userData = await this.$axios.$get(endpoint)
          commit('SET_USER', userData.user)
        } catch (e) {
          return dispatch('invalidate')
        }
      }
    },

    // Login
    async login ({ commit, dispatch }, { fields, endpoint = 'auth/login', session = false } = {}) {
      // Send credentials to API
      
      let user = await this.$axios.$post(endpoint, fields, { withCredentials: true })

      // let token = tokenData.token || tokenData.id_token
      // fetch('http://138.197.137.65:8000/api/v0/login', {
      fetch('https://api.servdshop.com/api/v0/login', {
        method: 'post',
        mode: 'cors',
        body: JSON.stringify(fields),
        credentials: 'include'
      }).then(response => {
          console.log('header authorization', response.headers.get('authorization'))
          console.log('auth cookie', response.headers.get('set-cookie'))
        })

      // Update new token
      // await dispatch('updateToken', token)

      // Fetch authenticated user
      await dispatch('fetch', { user })
    },

    // Logout
    async logout ({ commit, dispatch, state }, { endpoint = 'auth/logout', appendToken = false } = {}) {
      // Append token
      if (appendToken) {
        endpoint = endpoint + '/' + state.token
      }

      // Server side logout
      try {
        await this.$axios.$get(endpoint)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error while logging out', e)
      }

      // Unload user profile & token
      await dispatch('invalidate')
    }
  }
}
