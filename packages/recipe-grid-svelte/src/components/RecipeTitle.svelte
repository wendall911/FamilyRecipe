<script lang="ts">
    /*
     * The recipe title, rendered outside the card. It is the model's `title`
     * string as an <h1> -- not part of the walked structure, so a consumer
     * places it wherever the layout wants the heading.
     */
    let { title }: { title: string } = $props();
</script>

<svelte:element this={'h1'}>{title}</svelte:element>
