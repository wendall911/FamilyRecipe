<script lang="ts">
    /*
     * The recipe description, rendered outside the card. It is the model's
     * `description` string as a <p> -- not part of the walked structure, so a
     * consumer places it wherever the layout wants the intro prose.
     */
    let { description }: { description: string } = $props();
</script>

<svelte:element this={'p'}>{description}</svelte:element>
