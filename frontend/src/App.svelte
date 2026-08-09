<script>
  import Router from 'svelte-spa-router';
  import { wrap } from 'svelte-spa-router/wrap';
  import BoardsList from './lib/BoardsList.svelte';
  import BoardView from './lib/BoardView.svelte';
  import './app.css';

  const API = import.meta.env.VITE_API_URL || '';

  const routes = {
    '/': wrap({ component: BoardsList, props: { api: API } }),
    '/board/:id': wrap({ component: BoardView, props: { api: API } })
  };
</script>

<Router {routes} />
